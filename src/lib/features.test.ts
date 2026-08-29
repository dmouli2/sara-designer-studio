import { describe, it, expect } from "vitest";
import {
  FEATURE_SCAN_ORDERS,
  FEATURE_MULTI_PIECE,
  FEATURE_ALTERATIONS,
  assertScanFeatureEnabled,
  assertAlterationsEnabled,
} from "./features";

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

  it("exposes the multi-piece and alteration flags as booleans", () => {
    expect(typeof FEATURE_MULTI_PIECE).toBe("boolean");
    expect(typeof FEATURE_ALTERATIONS).toBe("boolean");
  });

  it("assertAlterationsEnabled matches the flag", () => {
    if (FEATURE_ALTERATIONS) {
      expect(() => assertAlterationsEnabled()).not.toThrow();
    } else {
      expect(() => assertAlterationsEnabled()).toThrow("disabled");
    }
  });
});
