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
