"use client";

import type { BlouseMeasurements } from "@/types";

export function emptyBlouse(): BlouseMeasurements {
  return {
    type: "blouse",
    length: "", shoulder: "", hs: "", sl: "",
    mlos: "", tlos: "", ahs: "", bust: "",
    ub: "", waist: "", fnNr: "", bn: "",
    dart: "", dbd: "", p: "", sareeFall: "", piko: "",
  };
}

// Labels match the physical order form exactly (see MeasurementGrid.tsx).
const MEASUREMENT_FIELDS: { key: keyof Omit<BlouseMeasurements, "type">; label: string }[] = [
  { key: "length",    label: "Length" },
  { key: "shoulder",  label: "Shoulder" },
  { key: "hs",        label: "HS" },
  { key: "sl",        label: "S.L" },
  { key: "mlos",      label: "MLOS" },
  { key: "tlos",      label: "TLOS" },
  { key: "ahs",       label: "AHS" },
  { key: "bust",      label: "Bust" },
  { key: "ub",        label: "UB" },
  { key: "waist",     label: "Waist" },
  { key: "fnNr",      label: "FN / NR" },
  { key: "bn",        label: "BN" },
  { key: "dart",      label: "Dart" },
  { key: "dbd",       label: "DBD" },
  { key: "p",         label: "P" },
  { key: "sareeFall", label: "Saree Fall" },
  { key: "piko",      label: "Piko" },
];

interface Props {
  value: BlouseMeasurements;
  onChange: (v: BlouseMeasurements) => void;
}

export default function BlouseMeasurementForm({ value, onChange }: Props) {
  function setField(key: keyof Omit<BlouseMeasurements, "type">, v: string) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="rounded-2xl border border-[#E5E0D5] overflow-hidden bg-white">
      {/* Header */}
      <div className="grid grid-cols-[1fr_96px] bg-[#F9F8F6] border-b border-[#E5E0D5] px-3 py-2">
        <span className="text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide">Field</span>
        <span className="text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide text-center">L.B</span>
      </div>

      {MEASUREMENT_FIELDS.map(({ key, label }, i) => (
        <div
          key={key}
          className={`grid grid-cols-[1fr_96px] items-center px-3 py-2 gap-2 ${i % 2 === 1 ? "bg-[#FDFCFA]" : "bg-white"} ${i > 0 ? "border-t border-[#F0EDE6]" : ""}`}
        >
          <span className="text-xs text-[#0F0F0F]">{label}</span>
          <input
            className="w-full text-center text-sm border border-[#E5E0D5] rounded-lg py-1.5 focus:outline-none focus:border-[#C9A84C]"
            placeholder="—"
            type="number"
            value={value[key]}
            onChange={(e) => setField(key, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
