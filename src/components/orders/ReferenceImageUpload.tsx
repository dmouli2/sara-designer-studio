"use client";

import { useRef, useState } from "react";
import { compressImageToDataUrl } from "@/lib/image";

interface Props {
  value: string | null;        // base64 dataURL or null
  onChange: (v: string | null) => void;
}

export default function ReferenceImageUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    try {
      onChange(await compressImageToDataUrl(file));
    } catch {
      // Fall back to the raw file if compression fails for any reason
      // (e.g. an unusual image format the canvas can't decode).
      const reader = new FileReader();
      reader.onload = () => onChange(reader.result as string);
      reader.readAsDataURL(file);
    } finally {
      setCompressing(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      {value ? (
        <div className="relative rounded-2xl overflow-hidden border border-[#E5E0D5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Reference" className="w-full object-cover max-h-64" />
          <div className="absolute bottom-0 inset-x-0 flex gap-2 p-3 bg-gradient-to-t from-black/40 to-transparent">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={compressing}
              className="flex-1 py-2 rounded-xl text-xs font-medium bg-white/90 text-[#0F0F0F] disabled:opacity-40"
            >
              {compressing ? "Processing…" : "Change photo"}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={compressing}
              className="py-2 px-4 rounded-xl text-xs font-medium bg-white/90 text-[#C0392B] disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={compressing}
          className="w-full border-2 border-dashed border-[#E5E0D5] rounded-2xl p-8 text-center bg-white active:bg-[#F9F8F6] transition-colors disabled:opacity-40"
        >
          <p className="text-3xl mb-2">📷</p>
          <p className="text-sm text-[#0F0F0F] font-medium">
            {compressing ? "Processing photo…" : "Tap to add reference photo"}
          </p>
          <p className="text-xs text-[#9A9A9A] mt-1">Opens camera or photo library</p>
        </button>
      )}
    </div>
  );
}
