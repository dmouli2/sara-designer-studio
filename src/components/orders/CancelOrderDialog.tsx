"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  orderId: string;
  pending: boolean;
  onConfirm: (charge: number) => void;
  onCancel: () => void;
}

// The charge field resets on every open because the caller remounts this
// component with a fresh `key` each time `open` flips true (see
// AdminOrderDetailBody) rather than this component resetting its own state
// in an effect.
export default function CancelOrderDialog({ open, orderId, pending, onConfirm, onCancel }: Props) {
  const [charge, setCharge] = useState("");

  if (!open) return null;

  const parsed = parseFloat(charge);
  const valid = charge.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;

  function handleConfirm() {
    if (!valid) return;
    onConfirm(parsed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
        <p className="text-[16px] font-semibold text-[#0F0F0F]">Cancel order {orderId}?</p>
        <p className="text-[14px] text-[#6B6B6B] mt-2 leading-relaxed">
          Enter the cancellation charge to collect from the customer. The order&apos;s original amount will be
          struck through and replaced with this charge.
        </p>

        <div className="mt-4">
          <label htmlFor="cancellation-charge" className="text-xs text-[#9A9A9A] mb-1 block">
            Cancellation charge (₹)
          </label>
          <input
            id="cancellation-charge"
            className="input"
            type="number"
            min="0"
            autoFocus
            value={charge}
            onChange={(e) => setCharge(e.target.value)}
          />
        </div>

        <div className="flex gap-2 mt-6">
          <button type="button" onClick={onCancel} disabled={pending} className="btn-outline flex-1 disabled:opacity-40">
            Keep order
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending || !valid}
            className="flex-1 rounded-xl py-4 text-[15px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 bg-[#B04A4A] text-white shadow-[0_4px_14px_-2px_rgba(176,74,74,0.5)] active:opacity-80"
          >
            {pending ? "Cancelling…" : "Cancel order"}
          </button>
        </div>
      </div>
    </div>
  );
}
