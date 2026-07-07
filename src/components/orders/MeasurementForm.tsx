"use client";

import type { GarmentMeasurements } from "@/types";
import BlouseMeasurementForm from "./BlouseMeasurementForm";
import SalwarMeasurementForm from "./SalwarMeasurementForm";

// Lives in src/lib/measurements.ts (shared with the scan normalizer);
// re-exported here so existing imports keep working.
export { emptyMeasurementsForDress } from "@/lib/measurements";
import { emptyMeasurementsForDress } from "@/lib/measurements";

interface Props {
  dress: string;
  value: GarmentMeasurements;
  onChange: (v: GarmentMeasurements) => void;
}

export default function MeasurementForm({ dress, value, onChange }: Props) {
  if (dress === "Blouse" && value.type === "blouse") {
    return <BlouseMeasurementForm value={value} onChange={onChange} />;
  }
  if (dress === "Salwar" && value.type === "salwar") {
    return <SalwarMeasurementForm value={value} onChange={onChange} />;
  }
  // type mismatch after dress change — reset
  const fresh = emptyMeasurementsForDress(dress);
  onChange(fresh);
  return null;
}
