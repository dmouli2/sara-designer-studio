"use client";

import { cn } from "@/lib/utils";
import type { ReportDateRange, ReportDateRangePreset } from "@/lib/reports";

const PRESETS: { id: ReportDateRangePreset; label: string }[] = [
  { id: "this_month", label: "This Month" },
  { id: "last_3_months", label: "Last 3 Months" },
  { id: "all_time", label: "All Time" },
  { id: "custom", label: "Custom" },
];

interface Props {
  value: ReportDateRange;
  onChange: (value: ReportDateRange) => void;
}

export default function ReportDateRangeFilter({ value, onChange }: Props) {
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange({ ...value, preset: p.id })}
            className={cn(
              "flex-none px-4 py-2 rounded-full text-[13px] font-medium active:scale-95 transition-all",
              value.preset === p.id
                ? "bg-[#0F0F0F] text-white shadow-[0_2px_8px_-1px_rgba(15,15,15,0.3)]"
                : "bg-white border border-[#E5E0D5] text-[#6B6B6B]"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* `flex-1 min-w-0` on each half, not just `.input`'s `w-full`: two
          date boxes are the narrowest place in the app, and without the
          shrink permission they run off the right edge on a phone. */}
      {value.preset === "custom" && (
        <div className="flex gap-2 mt-2">
          <label className="flex-1 min-w-0 block">
            <span className="text-[11px] text-[#9A9A9A] mb-1 block">From</span>
            <input
              type="date"
              aria-label="Custom range from"
              className="input px-3 py-2.5 text-[14px]"
              value={value.customFrom}
              onChange={(e) => onChange({ ...value, customFrom: e.target.value })}
            />
          </label>
          <label className="flex-1 min-w-0 block">
            <span className="text-[11px] text-[#9A9A9A] mb-1 block">To</span>
            <input
              type="date"
              aria-label="Custom range to"
              className="input px-3 py-2.5 text-[14px]"
              value={value.customTo}
              onChange={(e) => onChange({ ...value, customTo: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
