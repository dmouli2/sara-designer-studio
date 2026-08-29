"use client";

import { RefreshCw } from "lucide-react";
import { cn, formatDate, openAlteration, shopToday } from "@/lib/utils";
import { FEATURE_ALTERATIONS } from "@/lib/features";
import type { AlterationRecord, Order } from "@/types";

interface Props {
  order: Order;
  pending: boolean;
  onStart: () => void;
  onComplete: () => void;
  onRedeliver: () => void;
}

// The whole alteration flow, as one card with exactly one button on it.
//
// The admin never picks a state from a list: each stage offers only the step
// that comes next, so there is nothing to get wrong.
//
//   Delivered ──[Came back for alteration]──▶ In alteration
//   In alteration ──[Alteration done]──▶ Ready to hand back
//   Ready to hand back ──[Handed back]──▶ Delivered, record closed
//
// Closed records stay listed underneath, so an order that was delivered,
// altered and delivered again reads as that history rather than as a state
// someone has to reconstruct.
export default function AlterationPanel({ order, pending, onStart, onComplete, onRedeliver }: Props) {
  const open = openAlteration(order);
  // Tolerates an absent list the way the repository's own default does —
  // this renders for orders written long before alterations existed.
  const closed = (order.alterations ?? []).filter((a) => a.redeliveredAt);

  // Only a delivered order can come back, and only one alteration runs at a
  // time. The flag hides the entry point without hiding an alteration that
  // is already open — those garments are real and still have to be closed out.
  const canStart = FEATURE_ALTERATIONS && !open && order.status === "delivered";

  if (!open && closed.length === 0 && !canStart) return null;

  return (
    <div className="space-y-3">
      <p className="section-label">Alterations</p>

      {open && <OpenAlteration record={open} pending={pending} onComplete={onComplete} onRedeliver={onRedeliver} />}

      {canStart && (
        <button
          type="button"
          onClick={onStart}
          className="w-full flex items-center justify-center gap-2 py-3.5 text-[14px] font-semibold text-[#6B4FA8] border border-[#D6CBEF] bg-[#F7F4FD] rounded-xl active:scale-[0.98] transition-all"
        >
          <RefreshCw size={16} />
          Came back for alteration
        </button>
      )}

      {closed.length > 0 && (
        <div className="rounded-2xl border border-[#E5E0D5] bg-white overflow-hidden">
          {closed.map((record, i) => (
            <div key={record.id} className={cn("px-3 py-2.5", i > 0 && "border-t border-[#F0EDE6]")}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium text-[#0F0F0F] min-w-0">
                  {record.pieceLabel ? `${record.pieceLabel} · ` : ""}Altered &amp; returned
                </span>
                <span className="text-[12px] text-[#9A9A9A] shrink-0 tabular-nums">
                  {formatDate(record.redeliveredAt!)}
                </span>
              </div>
              <p className="text-[12px] text-[#6B6B6B] mt-0.5">
                {record.reason || "No reason recorded"} · in {formatDate(record.receivedAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OpenAlteration({
  record,
  pending,
  onComplete,
  onRedeliver,
}: {
  record: AlterationRecord;
  pending: boolean;
  onComplete: () => void;
  onRedeliver: () => void;
}) {
  const done = !!record.completedAt;
  // The promised date is a real commitment to a customer standing in the
  // shop, so it gets the same overdue treatment an order's due date does.
  const overdue = !done && !!record.promisedAt && record.promisedAt < shopToday();

  return (
    <div className="rounded-2xl border border-[#D6CBEF] bg-[#F7F4FD] p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-[#4E3585]">
          {done ? "Alteration done — waiting for pickup" : "In alteration"}
          {record.pieceLabel ? ` · ${record.pieceLabel}` : ""}
        </p>
        {record.reason && <p className="text-[13px] text-[#6B4FA8] mt-1">{record.reason}</p>}
        <p className={cn("text-[12px] mt-1.5", overdue ? "font-semibold text-[#B04A4A]" : "text-[#6B4FA8]/80")}>
          {overdue ? "⚠ Was promised" : done ? "Was promised" : "Promised back"} {formatDate(record.promisedAt)}
          {" · took in "}
          {formatDate(record.receivedAt)}
        </p>
      </div>

      {done ? (
        <button
          type="button"
          onClick={onRedeliver}
          disabled={pending}
          className="w-full bg-[#1B6B3A] text-white rounded-xl py-3 text-[14px] font-semibold active:opacity-80 disabled:opacity-40 transition-all"
        >
          {pending ? "Saving…" : "✓ Handed back to customer"}
        </button>
      ) : (
        <button
          type="button"
          onClick={onComplete}
          disabled={pending}
          className="w-full bg-[#6B4FA8] text-white rounded-xl py-3 text-[14px] font-semibold active:opacity-80 disabled:opacity-40 transition-all"
        >
          {pending ? "Saving…" : "✓ Alteration done"}
        </button>
      )}
    </div>
  );
}
