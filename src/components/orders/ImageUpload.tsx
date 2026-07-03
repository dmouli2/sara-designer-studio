"use client";

import { useRef, useState, type ComponentType } from "react";
import { X } from "lucide-react";
import { compressImageToDataUrl } from "@/lib/image";

interface Props {
  value: string[]; // base64 dataURLs, max `max`
  onChange: (v: string[]) => void;
  max: number;
  altPrefix: string;
  removeLabelPrefix: string;
  addLabel: string;
  addIcon: ComponentType<{ size?: number; className?: string }>;
  // "environment" hints mobile browsers to open the rear camera directly
  // instead of the gallery picker — used by MaterialImageUpload, omitted for
  // ReferenceImageUpload where either source is equally likely.
  capture?: "environment" | "user";
}

// Shared compress-and-slot-fill behind ReferenceImageUpload and
// MaterialImageUpload — both are "pick/capture up to N photos, compress
// client-side, show thumbnails with a remove button" with only labels and
// the camera hint differing.
export default function ImageUpload({
  value,
  onChange,
  max,
  altPrefix,
  removeLabelPrefix,
  addLabel,
  addIcon: AddIcon,
  capture,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  const remaining = max - value.length;

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, remaining);
    e.target.value = ""; // allow re-selecting the same file(s) later
    if (files.length === 0) return;

    setCompressing(true);
    try {
      const compressed = await Promise.all(
        files.map((file) =>
          compressImageToDataUrl(file).catch(
            () =>
              new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
              })
          )
        )
      );
      onChange([...value, ...compressed]);
    } finally {
      setCompressing(false);
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={capture}
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      <div className="grid grid-cols-3 gap-2">
        {value.map((src, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-[#E5E0D5]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${altPrefix} ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`${removeLabelPrefix} ${i + 1}`}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-90 transition-transform"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={compressing}
            className="aspect-square rounded-xl border-2 border-dashed border-[#E5E0D5] bg-white flex flex-col items-center justify-center gap-1 active:bg-[#F9F8F6] transition-colors disabled:opacity-40"
          >
            <AddIcon size={20} className="text-[#9A9A9A]" />
            <span className="text-[10px] text-[#9A9A9A]">{compressing ? "Processing…" : addLabel}</span>
          </button>
        )}
      </div>

      <p className="text-xs text-[#9A9A9A]">
        {value.length}/{max} photos · {remaining > 0 ? `${remaining} more allowed` : "limit reached"}
      </p>
    </div>
  );
}
