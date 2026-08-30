"use client";

import { Spool } from "lucide-react";
import ImageGallery from "./ImageGallery";

interface Props {
  images: string[];
}

export default function MaterialImageGallery({ images }: Props) {
  return <ImageGallery images={images} altPrefix="Material" emptyIcon={<Spool size={30} aria-hidden="true" />} emptyText="No material photos" />;
}
