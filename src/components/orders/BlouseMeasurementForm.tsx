"use client";

import MeasurementFieldRow from "./MeasurementFieldRow";
import type { BlouseMeasurements } from "@/types";

// Template lives in src/lib/measurements.ts (shared with the scan
// normalizer); re-exported here so existing imports keep working.
export { emptyBlouse } from "@/lib/measurements";

type BlouseFieldKey = Exclude<keyof BlouseMeasurements, "type" | "fieldNotes">;

// Labels match the physical order form exactly (see MeasurementGrid.tsx).
const MEASUREMENT_FIELDS: { key: BlouseFieldKey; label: string }[] = [
  { key: "length",    label: "Length" },
  { key: "shoulder",  label: "Shoulder" },
  { key: "hs",        label: "HS" },
  { key: "sl",        label: "S.L" },
  { key: "mlos",      label: "MLOS" },
  { key: "tlos",      label: "TLOS" },
  { key: "ahs",       label: "AHS" },
  { key: "ub",        label: "UB" },
  { key: "bust",      label: "Bust" },
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
  function setField(key: BlouseFieldKey, v: string) {
    onChange({ ...value, [key]: v });
  }
  function setNote(key: BlouseFieldKey, v: string) {
    onChange({ ...value, fieldNotes: { ...value.fieldNotes, [key]: v } });
  }

  return (
    <div className="rounded-2xl border border-[#E5E0D5] overflow-hidden bg-white">
      {/* Header — mirrors MeasurementFieldRow's column layout */}
      <div className="flex items-center bg-[#F9F8F6] border-b border-[#E5E0D5] px-3 py-2 gap-2">
        <span className="w-[88px] shrink-0 text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide">Field</span>
        <span className="w-16 shrink-0 text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide text-center">L.B</span>
        <span className="w-28 shrink-0 text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide">Notes</span>
      </div>

      {MEASUREMENT_FIELDS.map(({ key, label }, i) => (
        <MeasurementFieldRow
          key={key}
          label={label}
          value={value[key]}
          note={value.fieldNotes?.[key] ?? ""}
          striped={i % 2 === 1}
          bordered={i > 0}
          onValueChange={(v) => setField(key, v)}
          onNoteChange={(v) => setNote(key, v)}
        />
      ))}
    </div>
  );
}
