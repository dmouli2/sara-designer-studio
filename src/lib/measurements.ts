import type { BlouseMeasurements, GarmentMeasurements, SalwarMeasurements } from "@/types";

// Empty measurement templates, shared by the entry forms (which re-export
// them) and the scan-extraction normalizer. They live here — not in the
// "use client" form components — because server-side code (the drafts
// action) also needs to build measurement objects.

export function emptyBlouse(): BlouseMeasurements {
  return {
    type: "blouse",
    length: "", shoulder: "", hs: "", sl: "",
    mlos: "", tlos: "", ahs: "", bust: "",
    ub: "", waist: "", fnNr: "", bn: "",
    dart: "", dbd: "", p: "", sareeFall: "", piko: "",
  };
}

export function emptySalwar(): SalwarMeasurements {
  return {
    type: "salwar",
    top: {
      length: "", shoulder: "",
      hs: "", sl: "", tlcs: "", ah: "", bust: "", ub: "",
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
