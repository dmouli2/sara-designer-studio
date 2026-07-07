import type { SlipExtractor } from "./types";
import { createGeminiSlipExtractor } from "./gemini/slipExtractor";

export * from "./types";

let extractor: SlipExtractor | null = null;

export function getSlipExtractor(): SlipExtractor {
  if (!extractor) {
    extractor = createGeminiSlipExtractor();
  }
  return extractor;
}

export function resetSlipExtractorForTests(): void {
  extractor = null;
}
