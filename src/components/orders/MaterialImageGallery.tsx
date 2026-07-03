"use client";

import ImageGallery from "./ImageGallery";

interface Props {
  images: string[];
}

export default function MaterialImageGallery({ images }: Props) {
  return <ImageGallery images={images} altPrefix="Material" emptyIcon="🧵" emptyText="No material photos" />;
}
