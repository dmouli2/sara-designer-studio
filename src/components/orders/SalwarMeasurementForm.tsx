"use client";

import { useState } from "react";
import MeasurementFieldRow from "./MeasurementFieldRow";
import type { SalwarMeasurements } from "@/types";

// Template lives in src/lib/measurements.ts (shared with the scan
// normalizer); re-exported here so existing imports keep working.
export { emptySalwar } from "@/lib/measurements";

// Labels match the physical order form exactly (see MeasurementGrid.tsx).
// O.Shalwar / L.Shalwar were dropped from the form — old orders that carry
// them still display in MeasurementGrid, they just can't be entered anymore.
const TOP_FIELDS: { key: keyof SalwarMeasurements["top"]; label: string }[] = [
  { key: "length",   label: "Length" },
  { key: "shoulder", label: "Shoulder" },
  { key: "hs",       label: "HS" },
  { key: "sl",       label: "S.L" },
  { key: "tlcs",     label: "TLCS" },
  { key: "ah",       label: "AH" },
  { key: "ub",       label: "UB" },
  { key: "bust",     label: "Bust" },
  { key: "waist",    label: "Waist" },
  { key: "hip",      label: "Hip" },
  { key: "fnNr",     label: "FN / NR" },
  { key: "bn",       label: "BN" },
];

const PANT_FIELDS: { key: keyof SalwarMeasurements["pant"]; label: string }[] = [
  { key: "height",     label: "Height" },
  { key: "hip",        label: "Hip" },
  { key: "waist",      label: "Waist" },
  { key: "kl",         label: "KL" },
  { key: "tl",         label: "TL" },
  { key: "fullLength", label: "Full Length" },
  { key: "yoke",       label: "Yoke" },
];

interface Props {
  value: SalwarMeasurements;
  onChange: (v: SalwarMeasurements) => void;
}

export default function SalwarMeasurementForm({ value, onChange }: Props) {
  const [tab, setTab] = useState<"top" | "pant">("top");

  function setTop(key: keyof SalwarMeasurements["top"], v: string) {
    onChange({ ...value, top: { ...value.top, [key]: v } });
  }
  function setPant(key: keyof SalwarMeasurements["pant"], v: string) {
    onChange({ ...value, pant: { ...value.pant, [key]: v } });
  }
  function setTopNote(key: keyof SalwarMeasurements["top"], v: string) {
    onChange({ ...value, topNotes: { ...value.topNotes, [key]: v } });
  }
  function setPantNote(key: keyof SalwarMeasurements["pant"], v: string) {
    onChange({ ...value, pantNotes: { ...value.pantNotes, [key]: v } });
  }

  return (
    <div className="space-y-4">
      {/* Section tabs */}
      <div className="flex rounded-xl border border-border overflow-hidden bg-white">
        {(["top", "pant"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition-all ${
              tab === t ? "bg-selected text-white" : "text-fg-3"
            }`}
          >
            {t === "top" ? "M. Top" : "M. Pant"}
          </button>
        ))}
      </div>

      {tab === "top" && (
        <div className="rounded-2xl border border-border overflow-hidden bg-white">
          {TOP_FIELDS.map(({ key, label }, i) => (
            <MeasurementFieldRow
              key={key}
              label={label}
              value={value.top[key] ?? ""}
              note={value.topNotes?.[key] ?? ""}
              striped={i % 2 === 1}
              bordered={i > 0}
              onValueChange={(v) => setTop(key, v)}
              onNoteChange={(v) => setTopNote(key, v)}
            />
          ))}
        </div>
      )}

      {tab === "pant" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border overflow-hidden bg-white">
            {PANT_FIELDS.map(({ key, label }, i) => (
              <MeasurementFieldRow
                key={key}
                label={label}
                value={value.pant[key]}
                note={value.pantNotes?.[key] ?? ""}
                striped={i % 2 === 1}
                bordered={i > 0}
                onValueChange={(v) => setPant(key, v)}
                onNoteChange={(v) => setPantNote(key, v)}
              />
            ))}
          </div>

          <div>
            <label className="text-xs text-fg-2 mb-1 block">Shawl</label>
            <input
              className="input"
              placeholder="Given / details"
              value={value.shawl}
              onChange={(e) => onChange({ ...value, shawl: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
