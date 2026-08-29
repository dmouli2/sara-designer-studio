"use client";

import { Minus, Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { MAX_ORDER_PIECES } from "@/types";

// How many garments this order is, cut to the one set of measurements below
// it — the shop's "three blouses from one saree" case.
//
// Deliberately just a number. Almost every customer collects everything at
// once, so the entry form asks the one question that is always true (how
// many) and nothing that is usually irrelevant (a name and a date per
// garment). All of them take the order's delivery date; if one of them later
// needs its own date, that is a pencil tap on the order page, where the rare
// case actually shows up.
//
// At 1 this stores nothing at all — the order is written exactly as orders
// always have been.
interface Props {
  count: number;
  // The order's delivery date, which every garment shares. Shown back so the
  // admin can see what they're committing to.
  orderDue: string;
  onChange: (count: number) => void;
  // Names the garments ("Blouse 1", "Blouse 2", …).
  labelPrefix: string;
}

export default function PiecesEditor({ count, orderDue, onChange, labelPrefix }: Props) {
  const safeCount = Math.max(count, 1);

  return (
    <div className="rounded-2xl border border-[#E5E0D5] bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-[#0F0F0F]">
            How many {labelPrefix.toLowerCase()}s?
          </p>
          <p className="text-[12px] text-[#9A9A9A] mt-0.5">
            {safeCount === 1
              ? "One garment, delivered in one go."
              : "Same measurements. Track each one as it's collected."}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <button
            type="button"
            aria-label="One less piece"
            disabled={safeCount <= 1}
            onClick={() => onChange(safeCount - 1)}
            className="w-9 h-9 rounded-full border border-[#E5E0D5] flex items-center justify-center text-[#0F0F0F] active:scale-90 transition-transform disabled:opacity-30"
          >
            <Minus size={16} />
          </button>
          <span className="text-[17px] font-semibold tabular-nums w-5 text-center" aria-live="polite">
            {safeCount}
          </span>
          <button
            type="button"
            aria-label="One more piece"
            disabled={safeCount >= MAX_ORDER_PIECES}
            onClick={() => onChange(safeCount + 1)}
            className="w-9 h-9 rounded-full border border-[#E5E0D5] flex items-center justify-center text-[#0F0F0F] active:scale-90 transition-transform disabled:opacity-30"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {safeCount > 1 && (
        <p className="px-4 py-2.5 text-[12px] text-[#7A6020] bg-[#FBF6E8] border-t border-[#EDD98A]">
          {labelPrefix} 1–{safeCount}, all due {orderDue ? formatDate(orderDue) : "on the delivery date"}.
          Any one of them can be handed over on its own day, and the order page keeps the count.
        </p>
      )}
    </div>
  );
}
