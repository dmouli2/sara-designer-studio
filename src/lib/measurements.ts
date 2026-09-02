import type { BlouseMeasurements, GarmentMeasurements, SalwarMeasurements } from "@/types";

// Empty measurement templates, shared by the entry forms (which re-export
// them) and the scan-extraction normalizer. They live here — not in the
// "use client" form components — because server-side code (the drafts
// action) also needs to build measurement objects.

export function emptyBlouse(): BlouseMeasurements {
  return {
    type: "blouse",
    length: "", shoulder: "", hs: "", sl: "",
    mlos: "", tlos: "", ahs: "", ub: "",
    bust: "", waist: "", fnNr: "", bn: "",
    dart: "", dbd: "", p: "", sareeFall: "", piko: "",
  };
}

export function emptySalwar(): SalwarMeasurements {
  return {
    type: "salwar",
    top: {
      length: "", shoulder: "",
      hs: "", sl: "", tlcs: "", ah: "", ub: "", bust: "",
      waist: "", hip: "", fnNr: "", bn: "",
    },
    pant: {
      height: "", hip: "", waist: "", kl: "", tl: "", fullLength: "", yoke: "",
    },
    shawl: "",
  };
}

export function emptyMeasurementsForDress(dress: string): GarmentMeasurements {
  if (dress === "Salwar") return emptySalwar();
  return emptyBlouse();
}

// Did anyone actually write a measurement on this order?
//
// Matches MeasurementGrid cell-for-cell: a bare remark with no number still
// counts, because the grid renders a cell for it. Used to decide whether the
// detail pages have a grid worth drawing at all, and — on a measurement-
// garment order, where the form is optional — whether what follows should be
// described as adjustments to the garment the customer left.
export function hasAnyMeasurement(meas: GarmentMeasurements | null | undefined): boolean {
  if (!meas) return false;
  // Walks the whole shape rather than listing fields per garment type, so a
  // field added to any of the three unions is counted without touching this.
  const walk = (value: unknown, key?: string): boolean => {
    if (key === "type") return false;
    if (typeof value === "string") return value.trim() !== "";
    if (value && typeof value === "object") {
      return Object.entries(value as Record<string, unknown>).some(([k, v]) => walk(v, k));
    }
    return false;
  };
  return walk(meas);
}
