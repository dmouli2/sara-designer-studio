"use client";

import { X } from "lucide-react";
import type { AssignedStaff } from "@/types";

export interface OrderFilterValues {
  masterId: string;
  tailorId: string;
  dueFrom: string;
  dueTo: string;
  createdFrom: string;
  createdTo: string;
}

export const EMPTY_ORDER_FILTERS: OrderFilterValues = {
  masterId: "",
  tailorId: "",
  dueFrom: "",
  dueTo: "",
  createdFrom: "",
  createdTo: "",
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

        <div>
          <p className="section-label">Assigned master</p>
          <select className="input" value={values.masterId} onChange={(e) => set("masterId", e.target.value)}>
            <option value="">All masters</option>
            {masters.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="section-label">Assigned tailor</p>
          <select className="input" value={values.tailorId} onChange={(e) => set("tailorId", e.target.value)}>
            <option value="">All tailors</option>
            {tailors.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="section-label">Due date</p>
          <div className="flex gap-2">
            <input
              type="date"
              aria-label="Due date from"
              className="input"
              value={values.dueFrom}
              onChange={(e) => set("dueFrom", e.target.value)}
            />
            <input
              type="date"
              aria-label="Due date to"
              className="input"
              value={values.dueTo}
              onChange={(e) => set("dueTo", e.target.value)}
            />
          </div>
        </div>

        <div>
          <p className="section-label">Order created</p>
          <div className="flex gap-2">
            <input
              type="date"
              aria-label="Created date from"
              className="input"
              value={values.createdFrom}
              onChange={(e) => set("createdFrom", e.target.value)}
            />
            <input
              type="date"
              aria-label="Created date to"
              className="input"
              value={values.createdTo}
              onChange={(e) => set("createdTo", e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClear} className="btn-outline flex-1">Clear all</button>
          <button type="button" onClick={onClose} className="btn-gold flex-1">Done</button>
        </div>
      </div>
    </div>
  );
}
