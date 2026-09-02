"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import MeasurementForm from "./MeasurementForm";
import type { GarmentMeasurements } from "@/types";

// The measurement form on an order where the customer left a garment to cut
// to. Nothing has to be measured — the garment is the measurement — but the
// shop does sometimes want one figure written down ("same blouse, two inches
// longer"), and the first version of this feature made that impossible.
//
// Folded away rather than removed: the fast path stays one tick and straight
// on to the items, and the seventeen boxes are one tap away when they matter.
// Opens by default when the order already carries measurements, so an edit
// never hides figures somebody entered earlier.
export default function CollapsibleMeasurements({
  dress,
  value,
  onChange,
  defaultOpen = false,
}: {
  dress: string;
  value: GarmentMeasurements;
  onChange: (v: GarmentMeasurements) => void;
  defaultOpen?: boolean;
}) {
  // Held in state, not derived from `value` on every render — the admin
  // clearing the last figure while the panel is open must not fold it shut
  // under their hands.
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded-2xl border border-border bg-surface overflow-hidden"
    >
      <summary className="flex items-center justify-between gap-2 px-4 py-3.5 cursor-pointer select-none">
        <span className="min-w-0">
          <span className="block text-[14px] font-medium text-fg">Add measurements (optional)</span>
          <span className="block text-[12px] text-fg-2 mt-0.5">
            Only if something differs from the garment they left.
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-fg-2 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-border-soft p-3">
        <MeasurementForm dress={dress} value={value} onChange={onChange} />
      </div>
    </details>
  );
}
