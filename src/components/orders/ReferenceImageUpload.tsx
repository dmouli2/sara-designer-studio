"use client";

import { useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import { compressImageToDataUrl } from "@/lib/image";
import { MAX_REFERENCE_IMAGES } from "@/types";

interface Props {
  value: string[];             // base64 dataURLs, max MAX_REFERENCE_IMAGES
  onChange: (v: string[]) => void;
}

export default function ReferenceImageUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  const remaining = MAX_REFERENCE_IMAGES - value.length;

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
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      <div className="grid grid-cols-3 gap-2">
        {value.map((src, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-[#E5E0D5]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Reference ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Remove reference photo ${i + 1}`}
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
            <Plus size={20} className="text-[#9A9A9A]" />
            <span className="text-[10px] text-[#9A9A9A]">{compressing ? "Processing…" : "Add"}</span>
          </button>
        )}
      </div>

      <p className="text-xs text-[#9A9A9A]">
        {value.length}/{MAX_REFERENCE_IMAGES} photos · {remaining > 0 ? `${remaining} more allowed` : "limit reached"}
      </p>
    </div>
  );
}
