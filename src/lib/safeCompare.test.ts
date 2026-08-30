// @vitest-environment node
import { describe, it, expect } from "vitest";
import { safeCompare } from "./safeCompare";

describe("safeCompare", () => {
  it("accepts identical strings", () => {
    expect(safeCompare("Bearer abc123", "Bearer abc123")).toBe(true);
  });

  it("rejects strings that differ", () => {
    expect(safeCompare("Bearer abc123", "Bearer abc124")).toBe(false);
  });

  it("rejects strings that differ only in the first character", () => {
    expect(safeCompare("xbc", "abc")).toBe(false);
  });

  // timingSafeEqual throws on buffers of different lengths, which is exactly
  // the case a naive implementation gets wrong; hashing first makes both sides
  // 32 bytes so this returns false rather than blowing up.
  it("rejects strings of different lengths without throwing", () => {
    expect(() => safeCompare("short", "a much longer secret value")).not.toThrow();
    expect(safeCompare("short", "a much longer secret value")).toBe(false);
  });

  it("handles empty strings on either side", () => {
    expect(safeCompare("", "")).toBe(true);
    expect(safeCompare("", "secret")).toBe(false);
    expect(safeCompare("secret", "")).toBe(false);
  });

  it("compares by value, not by reference", () => {
    const a = "token-" + "value";
    const b = "token-value";
    expect(safeCompare(a, b)).toBe(true);
  });

  it("distinguishes strings whose bytes differ beyond ASCII", () => {
    expect(safeCompare("naïve", "naive")).toBe(false);
    expect(safeCompare("naïve", "naïve")).toBe(true);
  });
});
