"use client";

import { Camera } from "lucide-react";
import ImageGallery from "./ImageGallery";

interface Props {
  images: string[];
}

export default function ReferenceImageGallery({ images }: Props) {
  return <ImageGallery images={images} altPrefix="Reference" emptyIcon={<Camera size={30} aria-hidden="true" />} emptyText="No reference photos" />;
}
