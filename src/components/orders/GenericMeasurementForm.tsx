"use client";

import type { GenericMeasurements } from "@/types";

export function emptyGeneric(): GenericMeasurements {
  return {
    type: "generic",
    bust: "", waist: "", hip: "", length: "",
    shoulder: "", sleeve: "", neckDepth: "", armRound: "",
  };
}

const FIELDS: { key: keyof Omit<GenericMeasurements, "type">; label: string }[] = [
  { key: "bust",      label: "Bust" },
  { key: "waist",     label: "Waist" },
  { key: "hip",       label: "Hip" },
  { key: "length",    label: "Length" },
  { key: "shoulder",  label: "Shoulder" },
  { key: "sleeve",    label: "Sleeve" },
  { key: "neckDepth", label: "Neck Depth" },
  { key: "armRound",  label: "Arm Round" },
];

interface Props {
  value: GenericMeasurements;
  onChange: (v: GenericMeasurements) => void;
}

export default function GenericMeasurementForm({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {FIELDS.map(({ key, label }) => (
        <div key={key}>
          <label className="text-xs text-[#9A9A9A] mb-1 block">{label}</label>
          <input
            className="input"
            placeholder="in"
            type="number"
            value={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
