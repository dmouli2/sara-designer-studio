import type { SlipExtraction } from "@/types";

// Port for reading a photographed order-book spread into structured data.
// Same ports-and-adapters posture as ImageStorage: vendor API calls live
// only inside an adapter directory (src/lib/extraction/gemini/), and the
// rest of the app depends on this interface alone, so the engine can be
// swapped without touching actions or UI.
export interface SlipExtractor {
  // `imageDataUrl` is a base64 data URL of the full spread photo. The
  // adapter detects the book type (Blouse/Salwar) from the slip's printed
  // header itself — callers never pre-select it.
  extract(imageDataUrl: string): Promise<SlipExtraction>;
}
