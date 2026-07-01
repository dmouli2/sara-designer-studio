"use client";

import type { GarmentMeasurements } from "@/types";
import BlouseMeasurementForm, { emptyBlouse } from "./BlouseMeasurementForm";
import SalwarMeasurementForm, { emptySalwar } from "./SalwarMeasurementForm";

export function emptyMeasurementsForDress(dress: string): GarmentMeasurements {
  if (dress === "Salwar") return emptySalwar();
  return emptyBlouse();
}

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
