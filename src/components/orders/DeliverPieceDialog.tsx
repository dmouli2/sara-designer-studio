"use client";

import { useState } from "react";
import { cn, formatCurrency, shopToday } from "@/lib/utils";
import type { OrderPiece, PaymentMethod } from "@/types";

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
  onConfirm: (
    collect: { amount: number; method: PaymentMethod } | undefined,
    handedOverOn: string
  ) => void;
  onCancel: () => void;
}

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
];

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
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  // Defaults to today, which is right most of the time — but the shop often
  // records a hand-over a day or two after the customer actually walked out,
  // and the date on the record should be the day it happened.
  const [handedOverOn, setHandedOverOn] = useState(() => shopToday());

  if (!open) return null;

  const typed = parseFloat(amount || "0") || 0;
  const collecting = isLast ? balance : Math.min(Math.max(typed, 0), balance);
  const needsMethod = collecting > 0;
  const overBalance = !isLast && typed > balance;
  // A garment that hasn't left yet hasn't been handed over.
  const futureDated = !!handedOverOn && handedOverOn > shopToday();
  const canConfirm =
    !pending && !overBalance && !!handedOverOn && !futureDated && (!needsMethod || method !== null);

  function confirm() {
    if (!canConfirm) return;
    onConfirm(
      collecting > 0 ? { amount: collecting, method: method ?? "cash" } : undefined,
      handedOverOn
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
        <p className="text-[16px] font-semibold text-[#0F0F0F]">Hand over {piece.label}</p>
        <p className="text-[14px] text-[#6B6B6B] mt-2 leading-relaxed">
          {isLast
            ? "This is the last piece — handing it over completes the order."
            : "The rest of the order stays open until its pieces go out."}
        </p>

        <div className="mt-4">
          <label className="text-xs text-[#9A9A9A] mb-1 block" htmlFor="piece-handed-over-on">
            Handed over on
          </label>
          <input
            id="piece-handed-over-on"
            className="input"
            type="date"
            max={shopToday()}
            value={handedOverOn}
            onChange={(e) => setHandedOverOn(e.target.value)}
          />
          {futureDated && (
            <p className="text-xs text-red-600 mt-1">That date hasn&apos;t happened yet.</p>
          )}
        </div>

        {balance > 0 ? (
          <>
            <div className="mt-3 rounded-2xl bg-[#FBF6E8] border border-[#EDD98A] px-4 py-3.5 flex items-baseline justify-between">
              <span className="text-[13px] font-medium text-[#7A6020]">
                {isLast ? "Balance to collect" : "Balance on the order"}
              </span>
              <span className="text-[20px] font-bold text-[#7A6020] tabular-nums">
                {formatCurrency(balance)}
              </span>
            </div>

            {!isLast && (
              <div className="mt-4">
                <label className="text-xs text-[#9A9A9A] mb-1 block" htmlFor="piece-collect">
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
                <p className="text-xs text-[#9A9A9A] mt-4 mb-2">
                  How was the {formatCurrency(collecting)} paid?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={method === m.id}
                      onClick={() => setMethod(m.id)}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-[14px] font-semibold transition-all active:scale-[0.98]",
                        method === m.id
                          ? "border-[#0F0F0F] bg-[#0F0F0F] text-white"
                          : "border-[#E5E0D5] bg-white text-[#0F0F0F]"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <p className="text-[14px] text-[#1B6B3A] mt-3">Nothing left to collect on this order.</p>

        )}

        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 py-3 rounded-xl border border-[#E5E0D5] bg-white text-[14px] font-medium text-[#6B6B6B] active:scale-[0.98] transition-all disabled:opacity-40"
          >
            Not yet
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className="flex-1 py-3 rounded-xl bg-[#1B6B3A] text-white text-[14px] font-semibold active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {pending ? "Saving…" : collecting > 0 ? "Collect & hand over" : "Hand over"}
          </button>
        </div>
      </div>
    </div>
  );
}
