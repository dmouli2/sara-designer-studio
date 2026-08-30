"use client";

import { useState } from "react";
import { cn, formatCurrency, splitTotal } from "@/lib/utils";
import type { PaymentSplit } from "@/types";

// How a payment arrived: all cash, all UPI, or some of each.
//
// "Both" is deliberately a third button rather than two always-visible amount
// boxes. A split is the rare payment; making every ordinary one cost two
// number entries would be a poor trade. Picking Cash or UPI is still one tap,
// exactly as before this existed.
//
// Controlled: the parent owns the split, and a single-method payment is
// simply the other side at zero.
interface Props {
  // What the payment must add up to. When null the amount is the admin's to
  // decide (an optional part payment), so no total is enforced.
  total: number | null;
  value: PaymentSplit;
  onChange: (split: PaymentSplit) => void;
  // Distinguishes the two pickers when both are on screen in one form.
  idPrefix: string;
}

type Mode = "cash" | "upi" | "both";

// Null until money has actually been attributed. Lighting up "Cash" for an
// empty split would claim a choice nobody made — and leave the admin staring
// at a selected button beside a disabled confirm.
function modeOf(split: PaymentSplit): Mode | null {
  if (split.cash > 0 && split.upi > 0) return "both";
  if (split.upi > 0) return "upi";
  if (split.cash > 0) return "cash";
  return null;
}

const MODES: { id: Mode; label: string }[] = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "both", label: "Both" },
];

export default function PaymentSplitPicker({ total, value, onChange, idPrefix }: Props) {
  // Which button is lit. Held locally so that choosing "Both" and clearing a
  // box doesn't bounce the selection back to Cash while the admin is typing.
  const [mode, setMode] = useState<Mode | null>(() => modeOf(value));

  function pick(next: Mode) {
    setMode(next);
    if (next === "cash") onChange({ cash: total ?? splitTotal(value), upi: 0 });
    else if (next === "upi") onChange({ cash: 0, upi: total ?? splitTotal(value) });
    // "Both" keeps whatever is there and lets the admin fill the boxes in;
    // pre-splitting the total in half would be a guess they'd have to undo.
  }

  const entered = splitTotal(value);
  const short = total !== null && mode === "both" && entered !== total;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => pick(m.id)}
            className={cn(
              "rounded-xl border px-2 py-3 text-[14px] font-semibold transition-all active:scale-[0.98]",
              mode === m.id
                ? "border-[#0F0F0F] bg-[#0F0F0F] text-white"
                : "border-[#E5E0D5] bg-white text-[#0F0F0F]"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "both" && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {(["cash", "upi"] as const).map((method) => (
              <div key={method}>
                <label
                  className="text-xs text-[#56524A] mb-1 block"
                  htmlFor={`${idPrefix}-${method}`}
                >
                  {method === "cash" ? "Cash (₹)" : "UPI (₹)"}
                </label>
                <input
                  id={`${idPrefix}-${method}`}
                  className="input"
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder="0"
                  value={value[method] || ""}
                  onChange={(e) =>
                    onChange({ ...value, [method]: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            ))}
          </div>
          {short && (
            <p className="text-xs text-red-600">
              {entered < total
                ? `${formatCurrency(total - entered)} still unaccounted for.`
                : `${formatCurrency(entered - total)} more than the ${formatCurrency(total)} due.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
