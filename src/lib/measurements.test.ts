import { describe, it, expect } from "vitest";
import {
  emptyBlouse,
  emptySalwar,
  emptyMeasurementsForDress,
  hasAnyMeasurement,
} from "./measurements";

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

// Decides whether the detail pages have a grid worth drawing, and whether a
// measurement-garment order's figures should be described as adjustments.
describe("hasAnyMeasurement", () => {
  it("is false for an untouched template of either garment", () => {
    expect(hasAnyMeasurement(emptyBlouse())).toBe(false);
    expect(hasAnyMeasurement(emptySalwar())).toBe(false);
  });

  it("is false for nothing at all", () => {
    expect(hasAnyMeasurement(null)).toBe(false);
    expect(hasAnyMeasurement(undefined)).toBe(false);
  });

  it("ignores the discriminator, which every template carries", () => {
    // "blouse" is a non-empty string sitting on `type` — counting it would
    // make every order look measured.
    expect(hasAnyMeasurement({ ...emptyBlouse(), type: "blouse" })).toBe(false);
  });

  it("is true for a single filled field, anywhere in the shape", () => {
    expect(hasAnyMeasurement({ ...emptyBlouse(), length: "15" })).toBe(true);
    const salwar = emptySalwar();
    expect(hasAnyMeasurement({ ...salwar, top: { ...salwar.top, bust: "36" } })).toBe(true);
    expect(hasAnyMeasurement({ ...salwar, pant: { ...salwar.pant, kl: "22" } })).toBe(true);
    expect(hasAnyMeasurement({ ...salwar, shawl: "2.5m" })).toBe(true);
  });

  it("counts a bare remark with no number, which the grid still draws a cell for", () => {
    expect(hasAnyMeasurement({ ...emptyBlouse(), fieldNotes: { bust: "loose" } })).toBe(true);
    const salwar = emptySalwar();
    expect(hasAnyMeasurement({ ...salwar, topNotes: { sl: "elbow" } })).toBe(true);
    expect(hasAnyMeasurement({ ...salwar, pantNotes: { yoke: "wide" } })).toBe(true);
  });

  // MeasurementNotes is a Partial map, so an entry can be present and
  // undefined — and jsonb round-trips can hand back a number where the type
  // says string. Neither is a measurement.
  it("ignores values that are neither text nor a nested shape", () => {
    expect(hasAnyMeasurement({ ...emptyBlouse(), fieldNotes: { bust: undefined } })).toBe(false);
    expect(
      hasAnyMeasurement({ ...emptyBlouse(), length: 15 } as unknown as ReturnType<typeof emptyBlouse>)
    ).toBe(false);
  });

  it("does not count whitespace as a measurement", () => {
    expect(hasAnyMeasurement({ ...emptyBlouse(), length: "   " })).toBe(false);
  });

  it("handles the generic garment shape", () => {
    const generic = {
      type: "generic" as const,
      bust: "", waist: "", hip: "", length: "", shoulder: "", sleeve: "", neckDepth: "", armRound: "",
    };
    expect(hasAnyMeasurement(generic)).toBe(false);
    expect(hasAnyMeasurement({ ...generic, hip: "38" })).toBe(true);
  });
});
