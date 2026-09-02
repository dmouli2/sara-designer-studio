"use client";

import { useState } from "react";
import { Shirt } from "lucide-react";
import { formatCurrency, shopToday, splitTotal } from "@/lib/utils";
import EventDateField, { isInvalidEventDate } from "./EventDateField";
import PaymentSplitPicker from "./PaymentSplitPicker";
import type { PaymentSplit } from "@/types";

interface Props {
  open: boolean;
  orderId: string;
  balance: number;
  // Set to the garment's label ("Measurement blouse") when the customer left
  // one of their own with this order, so the hand-over says to give it back.
  // Null on every ordinary order.
  returnLabel?: string | null;
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
  returnLabel = null,
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
      <div className="w-full max-w-sm bg-surface rounded-2xl p-6 shadow-2xl">
        <p className="text-[16px] font-semibold text-fg">Deliver order {orderId}</p>

        <div className="mt-4">
          <EventDateField
            id="order-delivered-on"
            label="Delivered on"
            value={deliveredOn}
            onChange={setDeliveredOn}
          />
        </div>

        {nothingToCollect ? (
          <p className="text-[14px] text-fg-3 mt-3 leading-relaxed">
            This order is already paid in full — nothing left to collect. Confirm to hand it over.
          </p>
        ) : (
          <>
            <p className="text-[14px] text-fg-3 mt-2 leading-relaxed">
              Collect the balance before handing the order over.
            </p>

            <div className="mt-4 rounded-2xl bg-gold-50 border border-gold-200 px-4 py-3.5 flex items-baseline justify-between">
              <span className="text-[13px] font-medium text-gold-800">Balance to collect</span>
              <span className="text-[20px] font-bold text-gold-800 tabular-nums">
                {formatCurrency(balance)}
              </span>
            </div>

            <p className="text-xs text-fg-2 mt-4 mb-2">How was it paid?</p>
            <PaymentSplitPicker
              idPrefix="deliver-order"
              total={balance}
              value={collected}
              onChange={setCollected}
            />
          </>
        )}

        {returnLabel && (
          // The customer's own garment is in the shop for this order. It is
          // theirs, and the hand-over is the last moment anyone will think
          // about it — so it is said here, where the admin is already
          // standing at the counter with the customer.
          <div className="mt-4 rounded-xl border border-gold-edge bg-gold-25 px-4 py-3 flex gap-2.5">
            <Shirt size={16} className="shrink-0 mt-0.5 text-accent-ink" aria-hidden="true" />
            <p className="text-[13px] text-accent-ink">
              Give the {returnLabel.toLowerCase()} back with the order — it belongs to the customer.
            </p>
          </div>
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
            onClick={() => canConfirm && onConfirm(collected, deliveredOn)}
            disabled={!canConfirm}
            className="flex-1 py-3 rounded-xl bg-success-fill text-white text-[14px] font-semibold active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {pending ? "Saving…" : nothingToCollect ? "Mark delivered" : "Collect & deliver"}
          </button>
        </div>
      </div>
    </div>
  );
}
