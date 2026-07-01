"use client";

import { useState } from "react";
import type { SalwarMeasurements } from "@/types";

export function emptySalwar(): SalwarMeasurements {
  return {
    type: "salwar",
    top: {
      oShalwar: "", lShalwar: "", length: "", shoulder: "",
      hs: "", sl: "", tlcs: "", ah: "", bust: "", ub: "",
      waist: "", hip: "", fnNr: "", bn: "", height: "",
    },
    pant: {
      hip: "", waist: "", kl: "", tl: "", fullLength: "", yoke: "",
    },
    shawl: "",
  };
}

const TOP_FIELDS: { key: keyof SalwarMeasurements["top"]; label: string }[] = [
  { key: "oShalwar", label: "Outer Shalwar" },
  { key: "lShalwar", label: "Lining Shalwar" },
  { key: "length",   label: "Length" },
  { key: "shoulder", label: "Shoulder" },
  { key: "hs",       label: "Half Shoulder" },
  { key: "sl",       label: "Sleeve Length" },
  { key: "tlcs",     label: "TLCS" },
  { key: "ah",       label: "Arm Hole" },
  { key: "bust",     label: "Bust" },
  { key: "ub",       label: "Under Bust" },
  { key: "waist",    label: "Waist" },
  { key: "hip",      label: "Hip" },
  { key: "fnNr",     label: "Front Neck / NR" },
  { key: "bn",       label: "Back Neck" },
  { key: "height",   label: "Height" },
];

const PANT_FIELDS: { key: keyof SalwarMeasurements["pant"]; label: string }[] = [
  { key: "hip",        label: "Hip" },
  { key: "waist",      label: "Waist" },
  { key: "kl",         label: "Knee Length" },
  { key: "tl",         label: "Thigh Length" },
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

  return (
    <div className="space-y-4">
      {/* Section tabs */}
      <div className="flex rounded-xl border border-[#E5E0D5] overflow-hidden bg-white">
        {(["top", "pant"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition-all ${
              tab === t ? "bg-[#0F0F0F] text-white" : "text-[#6B6B6B]"
            }`}
          >
            {t === "top" ? "M. Top" : "M. Pant"}
          </button>
        ))}
      </div>

      {tab === "top" && (
        <div className="rounded-2xl border border-[#E5E0D5] overflow-hidden bg-white">
          {TOP_FIELDS.map(({ key, label }, i) => (
            <div
              key={key}
              className={`flex items-center px-3 py-2 gap-3 ${i % 2 === 1 ? "bg-[#FDFCFA]" : "bg-white"} ${i > 0 ? "border-t border-[#F0EDE6]" : ""}`}
            >
              <span className="text-xs text-[#0F0F0F] flex-1">{label}</span>
              <input
                className="w-24 text-center text-sm border border-[#E5E0D5] rounded-lg py-1.5 focus:outline-none focus:border-[#C9A84C]"
                placeholder="in"
                type="number"
                value={value.top[key]}
                onChange={(e) => setTop(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {tab === "pant" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E5E0D5] overflow-hidden bg-white">
            {PANT_FIELDS.map(({ key, label }, i) => (
              <div
                key={key}
                className={`flex items-center px-3 py-2 gap-3 ${i % 2 === 1 ? "bg-[#FDFCFA]" : "bg-white"} ${i > 0 ? "border-t border-[#F0EDE6]" : ""}`}
              >
                <span className="text-xs text-[#0F0F0F] flex-1">{label}</span>
                <input
                  className="w-24 text-center text-sm border border-[#E5E0D5] rounded-lg py-1.5 focus:outline-none focus:border-[#C9A84C]"
                  placeholder="in"
                  type="number"
                  value={value.pant[key]}
                  onChange={(e) => setPant(key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs text-[#9A9A9A] mb-1 block">Shawl</label>
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
