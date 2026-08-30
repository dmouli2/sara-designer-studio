"use client";

import { useState } from "react";
import { shopToday } from "@/lib/utils";
import EventDateField, { isInvalidEventDate } from "./EventDateField";
import type { OrderPiece } from "@/types";

interface Props {
  open: boolean;
  orderId: string;
  // Offered as a picker only on a multi-piece order — on a single-garment
  // order there is nothing to choose between.
  pieces: OrderPiece[] | null;
  pending: boolean;
  onConfirm: (input: {
    reason: string;
    promisedAt: string;
    pieceLabel: string | null;
    receivedAt: string;
  }) => void;
  onCancel: () => void;
}

// A week is what the shop's own terms promise ("alterations will be done
// within 2 weeks"), and a week is what it actually takes — so the date is
// pre-filled rather than asked cold, and the admin only touches it when the
// customer needs something different.
const DEFAULT_TURNAROUND_DAYS = 7;

export function defaultPromisedDate(today: string = shopToday()): string {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + DEFAULT_TURNAROUND_DAYS);
  return date.toISOString().slice(0, 10);
}

// Taking a delivered garment back in. Deliberately two fields and a date:
// the admin is standing at the counter with a customer, and anything longer
// gets filled in with rubbish.
//
// Reset by remount with a fresh `key` when it opens, like the other dialogs.
export default function StartAlterationDialog({
  open,
  orderId,
  pieces,
  pending,
  onConfirm,
  onCancel,
}: Props) {
  const [reason, setReason] = useState("");
  const [promisedAt, setPromisedAt] = useState(() => defaultPromisedDate());
  const [pieceLabel, setPieceLabel] = useState("");
  // The day the customer actually brought it back, which may not be today.
  const [receivedAt, setReceivedAt] = useState(() => shopToday());

  if (!open) return null;

  const multi = (pieces?.length ?? 0) > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-sm bg-surface rounded-2xl p-6 shadow-2xl">
        <p className="text-[16px] font-semibold text-fg">Alteration for {orderId}</p>
        <p className="text-[14px] text-fg-3 mt-2 leading-relaxed">
          The order stays delivered — this just tracks the garment while it&apos;s back with us.
        </p>

        <div className="mt-4 space-y-3">
          {multi && (
            <div>
              <label className="text-xs text-fg-2 mb-1 block" htmlFor="alteration-piece">
                Which piece?
              </label>
              <select
                id="alteration-piece"
                className="input"
                value={pieceLabel}
                onChange={(e) => setPieceLabel(e.target.value)}
              >
                <option value="">Whole order</option>
                {pieces!.map((p) => (
                  <option key={p.id} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <EventDateField
            id="alteration-received"
            label="Taken in on"
            value={receivedAt}
            onChange={setReceivedAt}
          />

          <div>
            <label className="text-xs text-fg-2 mb-1 block" htmlFor="alteration-reason">
              What needs changing?
            </label>
            <textarea
              id="alteration-reason"
              className="input resize-none"
              rows={2}
              placeholder="Sleeve tight, hook shifted, length…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-fg-2 mb-1 block" htmlFor="alteration-promised">
              Promised back on *
            </label>
            <input
              id="alteration-promised"
              className="input"
              type="date"
              value={promisedAt}
              onChange={(e) => setPromisedAt(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 py-3 rounded-xl border border-border bg-surface text-[14px] font-medium text-fg-3 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || !promisedAt || isInvalidEventDate(receivedAt)}
            onClick={() =>
              onConfirm({ reason, promisedAt, pieceLabel: pieceLabel || null, receivedAt })
            }
            className="flex-1 py-3 rounded-xl bg-violet-fill text-white text-[14px] font-semibold active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {pending ? "Saving…" : "Take it in"}
          </button>
        </div>
      </div>
    </div>
  );
}
