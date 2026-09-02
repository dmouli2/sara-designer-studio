"use client";

import { sampleGarmentLabel } from "@/lib/utils";

// "Did the customer bring a garment to cut to?" — the one question that
// decides whether the seventeen measurement boxes below are asked at all.
//
// Shared by the new-order wizard and the edit screen so the two can never
// word it differently or, worse, disagree about what ticking it means. It
// sits directly above the measurement form and, when ticked, that form is
// not rendered: there is nothing to measure.
//
// Opt-in and off by default — most customers are measured at the counter.
export default function SampleGarmentToggle({
  dress,
  checked,
  onChange,
}: {
  dress: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const label = sampleGarmentLabel(dress).toLowerCase();
  return (
    <label className="flex items-start gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3.5 cursor-pointer">
      <input
        type="checkbox"
        className="mt-0.5 w-4 h-4 shrink-0 accent-gold"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-fg">
          Customer gave a {label}
        </span>
        <span className="block text-[12px] text-fg-2 mt-0.5">
          {checked
            ? "No measurements needed — we stitch to the garment they left, and it goes back with the order. Add any below only if something differs."
            : "Tick if they left one of their own to stitch to instead of being measured."}
        </span>
      </span>
    </label>
  );
}
