// Photos travel to Server Actions as multipart Files. The action body is
// capped at 4mb in next.config.ts and Vercel's own request ceiling is 4.5MB —
// checked client-side before submitting so an oversized order gets a clear
// "remove a photo" message instead of a request the server rejects before our
// code even runs, which used to surface as a misleading "connection" error.
export const MAX_PHOTO_PAYLOAD_BYTES = 3.5 * 1024 * 1024;

// Converts a base64 data URL (how the wizard holds photos in state, for
// previews and localStorage drafts) back into a File for submission.
// Photos must travel to the Server Action as multipart Files, never as
// base64 strings inside the arguments: React's action deserializer counts
// every string character inside nested arrays against a hard-coded 1e6
// budget ("Maximum array nesting exceeded"), so two ~470KB-char photos in
// one array kill the request — and binary is 33% smaller on the wire too.
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL");
  const [, contentType, base64] = match;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: contentType });
}

// Edit-order galleries mix freshly captured photos (base64 data URLs) with
// photos already in Storage (signed http URLs). A changed gallery is re-sent
// in full as Files, so existing entries are fetched back as blobs — Supabase
// Storage serves signed URLs with permissive CORS.
export async function galleryEntryToFile(src: string, filename: string): Promise<File> {
  if (src.startsWith("data:")) return dataUrlToFile(src, filename);
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to fetch existing photo (${res.status})`);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

// Resizes an image file to at most `maxDimension` on its longest edge and
// re-encodes it as JPEG, cutting typical phone-camera photos (2-8MB) down to
// tens of KB before they ever leave the device.
export function compressImageToDataUrl(
  file: File,
  maxDimension = 1200,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = objectUrl;
  });
}
