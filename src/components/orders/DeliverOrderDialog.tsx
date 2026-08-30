"use client";

import { useState } from "react";
import { formatCurrency, shopToday, splitTotal } from "@/lib/utils";
import EventDateField, { isInvalidEventDate } from "./EventDateField";
import PaymentSplitPicker from "./PaymentSplitPicker";
import type { PaymentSplit } from "@/types";

interface Props {
  open: boolean;
  orderId: string;
  balance: number;
  pending: boolean;
  onConfirm: (collected: PaymentSplit, deliveredOn: string) => void;
  onCancel: () => void;
}

// Handing an order over is also when the money arrives, so the two happen
// together: there is no way to mark an order delivered without saying how the
// balance was settled. The amount itself isn't editable — it is exactly what
// the order still owes, computed server-side in deliverOrder so the record
// can't drift from the arithmetic.
//
// Like CancelOrderDialog, this resets by being remounted with a fresh `key`
// each time it opens rather than clearing its own state in an effect.
export default function DeliverOrderDialog({
  open,
  orderId,
  balance,
  pending,
  onConfirm,
  onCancel,
}: Props) {
  // Starts empty so the admin has to say how the money arrived — the same
  // rule as before, now expressed as a split.
  const [collected, setCollected] = useState<PaymentSplit>({ cash: 0, upi: 0 });
  // The day it went home. Today is right most of the time, but the shop often
  // writes a hand-over up a day or two later.
  const [deliveredOn, setDeliveredOn] = useState(() => shopToday());

  if (!open) return null;

  // Fully paid up front — there is nothing to collect, so nothing to ask.
  const nothingToCollect = balance <= 0;
  const canConfirm =
    !pending &&
    !isInvalidEventDate(deliveredOn) &&
    (nothingToCollect || splitTotal(collected) === balance);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl">
        <p className="text-[16px] font-semibold text-[#0F0F0F]">Deliver order {orderId}</p>

        <div className="mt-4">
          <EventDateField
            id="order-delivered-on"
            label="Delivered on"
            value={deliveredOn}
            onChange={setDeliveredOn}
          />
        </div>

        {nothingToCollect ? (
          <p className="text-[14px] text-[#6B6B6B] mt-3 leading-relaxed">
            This order is already paid in full — nothing left to collect. Confirm to hand it over.
          </p>
        ) : (
          <>
            <p className="text-[14px] text-[#6B6B6B] mt-2 leading-relaxed">
              Collect the balance before handing the order over.
            </p>

            <div className="mt-4 rounded-2xl bg-[#FBF6E8] border border-[#EDD98A] px-4 py-3.5 flex items-baseline justify-between">
              <span className="text-[13px] font-medium text-[#7A6020]">Balance to collect</span>
              <span className="text-[20px] font-bold text-[#7A6020] tabular-nums">
                {formatCurrency(balance)}
              </span>
            </div>

            <p className="text-xs text-[#56524A] mt-4 mb-2">How was it paid?</p>
            <PaymentSplitPicker
              idPrefix="deliver-order"
              total={balance}
              value={collected}
              onChange={setCollected}
            />
          </>
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
            onClick={() => canConfirm && onConfirm(collected, deliveredOn)}
            disabled={!canConfirm}
            className="flex-1 py-3 rounded-xl bg-[#1B6B3A] text-white text-[14px] font-semibold active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {pending ? "Saving…" : nothingToCollect ? "Mark delivered" : "Collect & deliver"}
          </button>
        </div>
      </div>
    </div>
  );
}
