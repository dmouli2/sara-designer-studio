"use client";

import { Camera } from "lucide-react";
import ImageUpload from "./ImageUpload";
import { MAX_MATERIAL_IMAGES } from "@/types";

interface Props {
  value: string[]; // base64 dataURLs, max MAX_MATERIAL_IMAGES
  onChange: (v: string[]) => void;
}

// Photos of the actual fabric being used, captured right after choosing the
// material source (shop or customer-brought) — the first one taken becomes
// the "main" photo shown as the order-card thumbnail everywhere in the app.
export default function MaterialImageUpload({ value, onChange }: Props) {
  return (
    <ImageUpload
      value={value}
      onChange={onChange}
      max={MAX_MATERIAL_IMAGES}
      altPrefix="Material"
      removeLabelPrefix="Remove material photo"
      addLabel="Take photo"
      addIcon={Camera}
      capture="environment"
    />
  );
}
