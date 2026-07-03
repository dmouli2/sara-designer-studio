"use client";

import { Plus } from "lucide-react";
import ImageUpload from "./ImageUpload";
import { MAX_REFERENCE_IMAGES } from "@/types";

interface Props {
  value: string[]; // base64 dataURLs, max MAX_REFERENCE_IMAGES
  onChange: (v: string[]) => void;
}

export default function ReferenceImageUpload({ value, onChange }: Props) {
  return (
    <ImageUpload
      value={value}
      onChange={onChange}
      max={MAX_REFERENCE_IMAGES}
      altPrefix="Reference"
      removeLabelPrefix="Remove reference photo"
      addLabel="Add"
      addIcon={Plus}
    />
  );
}
