import { describe, it, expect } from "vitest";
import { DRESS_TYPES, LINE_ITEM_PRESETS, lineItemCategoryForDress } from "./mock";

describe("static mock data", () => {
  it("exposes dress types", () => {
    expect(DRESS_TYPES).toContain("Blouse");
    expect(DRESS_TYPES).toContain("Salwar");
  });

  it("exposes line item presets for blouse and salwar", () => {
    expect(LINE_ITEM_PRESETS.blouse.length).toBeGreaterThan(0);
    expect(LINE_ITEM_PRESETS.salwar.length).toBeGreaterThan(0);
  });
});

describe("lineItemCategoryForDress", () => {
  it("returns salwar for Salwar dress", () => {
    expect(lineItemCategoryForDress("Salwar")).toBe("salwar");
  });

  it("returns blouse for Blouse dress", () => {
    expect(lineItemCategoryForDress("Blouse")).toBe("blouse");
  });

  it("defaults to blouse for unknown dress types", () => {
    expect(lineItemCategoryForDress("Lehenga")).toBe("blouse");
  });
});
