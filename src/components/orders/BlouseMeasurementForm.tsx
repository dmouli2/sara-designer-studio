"use client";

import type { BlouseMeasurements, DualMeas } from "@/types";

export function emptyBlouse(): BlouseMeasurements {
  const d = (): DualMeas => ({ lb: "", ob: "" });
  return {
    type: "blouse",
    length: d(), shoulder: d(), hs: d(), sl: d(),
    mlos: d(), tlos: d(), ahs: d(), bust: d(),
    ub: d(), waist: d(), fnNr: d(), bn: d(),
    dart: "", dbd: "", p: "", sareeFall: "", piko: "",
  };
}

const DUAL_FIELDS: { key: keyof Omit<BlouseMeasurements, "type" | "dart" | "dbd" | "p" | "sareeFall" | "piko">; label: string }[] = [
  { key: "length",   label: "Length" },
  { key: "shoulder", label: "Shoulder" },
  { key: "hs",       label: "Half Shoulder" },
  { key: "sl",       label: "Sleeve Length" },
  { key: "mlos",     label: "Mid Sleeve" },
  { key: "tlos",     label: "Total Sleeve" },
  { key: "ahs",      label: "Arm Hole Size" },
  { key: "bust",     label: "Bust" },
  { key: "ub",       label: "Under Bust" },
  { key: "waist",    label: "Waist" },
  { key: "fnNr",     label: "Front Neck / NR" },
  { key: "bn",       label: "Back Neck" },
];

const SINGLE_FIELDS: { key: "dart" | "dbd" | "p" | "sareeFall" | "piko"; label: string }[] = [
  { key: "dart",      label: "Dart" },
  { key: "dbd",       label: "Dist. Between Darts" },
  { key: "p",         label: "Dart Point" },
  { key: "sareeFall", label: "Saree Fall" },
  { key: "piko",      label: "Piko" },
];

interface Props {
  value: BlouseMeasurements;
  onChange: (v: BlouseMeasurements) => void;
}

export default function BlouseMeasurementForm({ value, onChange }: Props) {
  function setDual(key: keyof Omit<BlouseMeasurements, "type" | "dart" | "dbd" | "p" | "sareeFall" | "piko">, side: "lb" | "ob", v: string) {
    onChange({ ...value, [key]: { ...(value[key] as DualMeas), [side]: v } });
  }
  function setSingle(key: "dart" | "dbd" | "p" | "sareeFall" | "piko", v: string) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="space-y-4">
      {/* Dual-variant table */}
      <div className="rounded-2xl border border-[#E5E0D5] overflow-hidden bg-white">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_80px] bg-[#F9F8F6] border-b border-[#E5E0D5] px-3 py-2">
          <span className="text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide">Field</span>
          <span className="text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide text-center">L.B</span>
          <span className="text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wide text-center">O.B</span>
        </div>

        {DUAL_FIELDS.map(({ key, label }, i) => {
          const dual = value[key] as DualMeas;
          return (
            <div
              key={key}
              className={`grid grid-cols-[1fr_80px_80px] items-center px-3 py-2 gap-2 ${i % 2 === 1 ? "bg-[#FDFCFA]" : "bg-white"}`}
            >
              <span className="text-xs text-[#0F0F0F]">{label}</span>
              <input
                className="w-full text-center text-sm border border-[#E5E0D5] rounded-lg py-1.5 focus:outline-none focus:border-[#C9A84C]"
                placeholder="—"
                type="number"
                value={dual.lb}
                onChange={(e) => setDual(key, "lb", e.target.value)}
              />
              <input
                className="w-full text-center text-sm border border-[#E5E0D5] rounded-lg py-1.5 focus:outline-none focus:border-[#C9A84C]"
                placeholder="—"
                type="number"
                value={dual.ob}
                onChange={(e) => setDual(key, "ob", e.target.value)}
              />
            </div>
          );
        })}
      </div>

      {/* Single-value fields */}
      <div className="grid grid-cols-2 gap-3">
        {SINGLE_FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs text-[#9A9A9A] mb-1 block">{label}</label>
            <input
              className="input"
              placeholder="in"
              type="number"
              value={value[key]}
              onChange={(e) => setSingle(key, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
