"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ScanLine } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import Toast from "@/components/layout/Toast";
import ImageUpload from "@/components/orders/ImageUpload";
import { dataUrlToFile, MAX_PHOTO_PAYLOAD_BYTES } from "@/lib/image";
import { createDraftFromScan } from "@/app/actions/drafts";

// Handwriting needs pixels: the fabric-thumbnail defaults (1200px/0.7) blur
// pen digits, so the slip photo keeps much more resolution while staying
// comfortably inside the 3.5 MB payload check below.
export const SCAN_MAX_DIMENSION = 2800;
export const SCAN_JPEG_QUALITY = 0.85;

export default function ScanCapture() {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRead() {
    const image = images[0];
    if (!image || reading) return;
    if (Math.round(image.length * 0.75) > MAX_PHOTO_PAYLOAD_BYTES) {
      setError("The photo is too large to send (limit 3.5 MB). Retake it a little further from the page.");
      return;
    }

    setReading(true);
    try {
      const photos = new FormData();
      photos.append("scan", dataUrlToFile(image, "scan-1.jpg"));
      const result = await createDraftFromScan(photos);
      if (!result.ok) {
        // The photo is kept so the admin can retry without re-shooting.
        setError(result.message);
        setReading(false);
        return;
      }
      // Straight into the prefilled wizard — corrections and placing the
      // order happen there; there is no intermediate review page.
      router.push(`/admin/orders/new?draft=${result.id}`);
    } catch {
      // Only transport-level failures reach here — createDraftFromScan
      // reports every failure it can explain in its result (see the
      // CreateDraftResult comment in src/app/actions/drafts.ts).
      setError("Couldn't reach the server — check your connection and try again.");
      setReading(false);
    }
  }

  return (
    <div className="screen">
      <TopBar
        title="Scan Order Slip"
        subtitle="Photograph the full book spread"
        onBack={() => router.back()}
      />

      <div className="scroll-area px-4 pt-5 space-y-5">
        <div className="rounded-2xl border border-gold-200 bg-gold-50 p-4">
          <p className="text-sm font-semibold text-gold-800">For an accurate read</p>
          <ul className="text-xs text-accent-ink mt-1.5 space-y-1 list-disc list-inside">
            <li>Lay the book flat and fill the frame with the whole spread</li>
            <li>Include both the measurement slip and the bill side</li>
            <li>Good light, no shadows across the handwriting</li>
          </ul>
        </div>

        <div>
          <p className="section-label">Slip photo</p>
          <ImageUpload
            value={images}
            onChange={setImages}
            max={1}
            altPrefix="Order slip scan"
            removeLabelPrefix="Remove scan"
            addLabel="Scan slip"
            addIcon={Camera}
            capture="environment"
            maxDimension={SCAN_MAX_DIMENSION}
            quality={SCAN_JPEG_QUALITY}
          />
        </div>

        <button
          onClick={handleRead}
          disabled={images.length === 0 || reading}
          className="btn-gold disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <ScanLine size={18} />
          {reading ? "Reading slip…" : "Read slip"}
        </button>
        <p className="text-xs text-fg-2 text-center -mt-2">
          The order type (Blouse/Salwar) is detected automatically. Everything is saved as a
          draft for you to verify — no order is placed yet.
        </p>
        <div className="h-4" />
      </div>

      <Toast message={error} onDismiss={() => setError(null)} />
    </div>
  );
}
