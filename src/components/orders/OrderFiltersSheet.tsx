"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssignedStaff } from "@/types";

export interface OrderFilterValues {
  masterId: string;
  tailorId: string;
  due: string;
}

export const EMPTY_ORDER_FILTERS: OrderFilterValues = {
  masterId: "",
  tailorId: "",
  due: "",
};

export function hasActiveFilters(values: OrderFilterValues): boolean {
  return Object.values(values).some((v) => v !== "");
}

interface Props {
  open: boolean;
  values: OrderFilterValues;
  masters: AssignedStaff[];
  tailors: AssignedStaff[];
  onChange: (values: OrderFilterValues) => void;
  onClear: () => void;
  onClose: () => void;
}

function StaffChipRow({
  label,
  staff,
  selectedId,
  onSelect,
}: {
  label: string;
  staff: AssignedStaff[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className="section-label">{label}</p>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
        <button
          type="button"
          onClick={() => onSelect("")}
          className={cn(
            "flex-none px-4 py-2 rounded-full text-[13px] font-medium active:scale-95 transition-all",
            selectedId === "" ? "bg-[#0F0F0F] text-white" : "bg-white border border-[#E5E0D5] text-[#6B6B6B]"
          )}
        >
          All
        </button>
        {staff.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={cn(
              "flex-none px-4 py-2 rounded-full text-[13px] font-medium active:scale-95 transition-all",
              selectedId === s.id ? "bg-[#0F0F0F] text-white" : "bg-white border border-[#E5E0D5] text-[#6B6B6B]"
            )}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function OrderFiltersSheet({ open, values, masters, tailors, onChange, onClear, onClose }: Props) {
  if (!open) return null;

  function set<K extends keyof OrderFilterValues>(key: K, value: OrderFilterValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#0F0F0F]">Filter orders</p>
          <button
            type="button"
            aria-label="Close filters"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F0EDE6]"
          >
            <X size={16} />
          </button>
        </div>

        <StaffChipRow label="Assigned master" staff={masters} selectedId={values.masterId} onSelect={(id) => set("masterId", id)} />
        <StaffChipRow label="Assigned tailor" staff={tailors} selectedId={values.tailorId} onSelect={(id) => set("tailorId", id)} />

        <div>
          <p className="section-label">Due date</p>
          <input
            type="date"
            aria-label="Due date"
            className="input"
            value={values.due}
            onChange={(e) => set("due", e.target.value)}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClear} className="btn-outline flex-1">Clear all</button>
          <button type="button" onClick={onClose} className="btn-gold flex-1">Done</button>
        </div>
      </div>
    </div>
  );
}
