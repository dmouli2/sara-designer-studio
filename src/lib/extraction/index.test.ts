import { describe, it, expect, beforeEach } from "vitest";
import { getSlipExtractor, resetSlipExtractorForTests } from "./index";

describe("getSlipExtractor", () => {
  beforeEach(() => {
    resetSlipExtractorForTests();
  });

  it("returns a memoized extractor instance", () => {
    const first = getSlipExtractor();
    expect(typeof first.extract).toBe("function");
    expect(getSlipExtractor()).toBe(first);
  });

  it("resetSlipExtractorForTests forces a fresh instance", () => {
    const first = getSlipExtractor();
    resetSlipExtractorForTests();
    expect(getSlipExtractor()).not.toBe(first);
  });
});
