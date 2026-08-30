"use client";

import { shopToday } from "@/lib/utils";

// "The day this actually happened" — a hand-over, a delivery, a garment
// coming back for alteration.
//
// One component because all of them share the same rule and it should be
// stated once: today by default (right most of the time, so the common case
// costs no taps), any earlier day accepted because the shop writes things up
// when it gets a moment rather than at the counter, and never a future one.
interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

// True when the date can't be accepted — empty, or not yet happened. The
// dialogs use this to hold their confirm button, and the server re-checks it.
export function isInvalidEventDate(value: string): boolean {
  return !value || value > shopToday();
}

export default function EventDateField({ id, label, value, onChange }: Props) {
  const future = !!value && value > shopToday();
  return (
    <div>
      <label className="text-xs text-fg-2 mb-1 block" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        type="date"
        max={shopToday()}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {future && <p className="text-xs text-red-600 mt-1">That date hasn&apos;t happened yet.</p>}
    </div>
  );
}
