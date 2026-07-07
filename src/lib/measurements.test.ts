import { describe, it, expect } from "vitest";
import { emptyBlouse, emptySalwar, emptyMeasurementsForDress } from "./measurements";

describe("measurements templates", () => {
  it("emptyBlouse has every field blank and the blouse discriminator", () => {
    const m = emptyBlouse();
    expect(m.type).toBe("blouse");
    const fields = Object.entries(m).filter(([key]) => key !== "type");
    expect(fields.every(([, v]) => v === "")).toBe(true);
    expect(fields).toHaveLength(17);
  });

  it("emptySalwar has blank top/pant/shawl sections", () => {
    const m = emptySalwar();
    expect(m.type).toBe("salwar");
    expect(Object.values(m.top).every((v) => v === "")).toBe(true);
    expect(Object.values(m.pant).every((v) => v === "")).toBe(true);
    expect(m.shawl).toBe("");
  });

  it("emptyMeasurementsForDress picks salwar only for Salwar", () => {
    expect(emptyMeasurementsForDress("Salwar").type).toBe("salwar");
    expect(emptyMeasurementsForDress("Blouse").type).toBe("blouse");
    expect(emptyMeasurementsForDress("Anything").type).toBe("blouse");
  });
});
