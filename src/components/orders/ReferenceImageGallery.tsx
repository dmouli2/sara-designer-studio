"use client";

import ImageGallery from "./ImageGallery";

interface Props {
  images: string[];
}

export default function ReferenceImageGallery({ images }: Props) {
  return <ImageGallery images={images} altPrefix="Reference" emptyIcon="📷" emptyText="No reference photos" />;
}
