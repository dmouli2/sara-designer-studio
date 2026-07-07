import { describe, it, expect } from "vitest";
import { FEATURE_SCAN_ORDERS, assertScanFeatureEnabled } from "./features";

describe("features", () => {
  it("exposes the scan feature flag as a boolean", () => {
    expect(typeof FEATURE_SCAN_ORDERS).toBe("boolean");
  });

  it("assertScanFeatureEnabled matches the flag", () => {
    if (FEATURE_SCAN_ORDERS) {
      expect(() => assertScanFeatureEnabled()).not.toThrow();
    } else {
      expect(() => assertScanFeatureEnabled()).toThrow("disabled");
    }
  });
});
