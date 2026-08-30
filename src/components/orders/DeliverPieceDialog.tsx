"use client";

import { useState } from "react";
import { formatCurrency, shopToday, splitTotal } from "@/lib/utils";
import EventDateField, { isInvalidEventDate } from "./EventDateField";
import PaymentSplitPicker from "./PaymentSplitPicker";
import type { OrderPiece, PaymentSplit } from "@/types";

interface Props {
  open: boolean;
  piece: OrderPiece;
  // What the whole order still owes, not this garment's share — money is
  // tracked per order, and the admin decides how much of it arrives today.
  balance: number;
  // True when this is the only piece still in the shop. The hand-over then
  // settles the order, so the amount stops being a choice.
  isLast: boolean;
  pending: boolean;
  onConfirm: (collect: PaymentSplit | undefined, handedOverOn: string) => void;
  onCancel: () => void;
}

// Handing over one garment of a multi-piece order.
//
// Two shapes, one dialog. For the LAST piece this is the order being
// delivered, so it behaves exactly like DeliverOrderDialog: the full
// remaining balance, no editable amount, method required. For an earlier
// piece the customer may pay something, all of it, or nothing — so the
// amount is optional and defaults to nothing, and the method is only asked
// for once a number has been typed.
//
// Reset by remount with a fresh `key` when it opens, like the other dialogs.
export default function DeliverPieceDialog({
  open,
  piece,
  balance,
  isLast,
  pending,
  onConfirm,
  onCancel,
}: Props) {
  const [amount, setAmount] = useState("");
  const [split, setSplit] = useState<PaymentSplit>({ cash: 0, upi: 0 });
  // Defaults to today, which is right most of the time — but the shop often
  // records a hand-over a day or two after the customer actually walked out,
  // and the date on the record should be the day it happened.
  const [handedOverOn, setHandedOverOn] = useState(() => shopToday());

  if (!open) return null;

  const typed = parseFloat(amount || "0") || 0;
  const collecting = isLast ? balance : Math.min(Math.max(typed, 0), balance);
  const needsMethod = collecting > 0;
  const overBalance = !isLast && typed > balance;
  // Whatever was entered has to account for exactly what's being collected —
  // the picker fills a single-method choice in for itself.
  const accounted = !needsMethod || splitTotal(split) === collecting;
  const canConfirm =
    !pending && !overBalance && !isInvalidEventDate(handedOverOn) && accounted;

  function confirm() {
    if (!canConfirm) return;
    onConfirm(collecting > 0 ? split : undefined, handedOverOn);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-sm bg-surface rounded-2xl p-6 shadow-2xl">
        <p className="text-[16px] font-semibold text-fg">Hand over {piece.label}</p>
        <p className="text-[14px] text-fg-3 mt-2 leading-relaxed">
          {isLast
            ? "This is the last piece — handing it over completes the order."
            : "The rest of the order stays open until its pieces go out."}
        </p>

        <div className="mt-4">
          <EventDateField
            id="piece-handed-over-on"
            label="Handed over on"
            value={handedOverOn}
            onChange={setHandedOverOn}
          />
        </div>

        {balance > 0 ? (
          <>
            <div className="mt-3 rounded-2xl bg-gold-50 border border-gold-200 px-4 py-3.5 flex items-baseline justify-between">
              <span className="text-[13px] font-medium text-gold-800">
                {isLast ? "Balance to collect" : "Balance on the order"}
              </span>
              <span className="text-[20px] font-bold text-gold-800 tabular-nums">
                {formatCurrency(balance)}
              </span>
            </div>

            {!isLast && (
              <div className="mt-4">
                <label className="text-xs text-fg-2 mb-1 block" htmlFor="piece-collect">
                  Collecting now (₹) — leave blank if nothing
                </label>
                <input
                  id="piece-collect"
                  className="input"
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {overBalance && (
                  <p className="text-xs text-red-600 mt-1">
                    That&apos;s more than the {formatCurrency(balance)} still owed.
                  </p>
                )}
              </div>
            )}

            {needsMethod && (
              <>
                <p className="text-xs text-fg-2 mt-4 mb-2">
                  How was the {formatCurrency(collecting)} paid?
                </p>
                <PaymentSplitPicker
                  idPrefix="deliver-piece"
                  total={collecting}
                  value={split}
                  onChange={setSplit}
                />
              </>
            )}
          </>
        ) : (
          <p className="text-[14px] text-success mt-3">Nothing left to collect on this order.</p>

        )}

        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 py-3 rounded-xl border border-border bg-surface text-[14px] font-medium text-fg-3 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            Not yet
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className="flex-1 py-3 rounded-xl bg-success-fill text-white text-[14px] font-semibold active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {pending ? "Saving…" : collecting > 0 ? "Collect & hand over" : "Hand over"}
          </button>
        </div>
      </div>
    </div>
  );
}
