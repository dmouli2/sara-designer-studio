"use client";

import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { cn, formatDate, isOrderOverdue } from "@/lib/utils";
import type { Order, OrderPiece } from "@/types";

interface Props {
  // Only the two fields it actually reads, so the read-only views can pass a
  // PublicOrder (which has no master/tailor/measurements) unchanged.
  order: Pick<Order, "pieces" | "status">;
  // Admin-only affordances. Omitted on read-only views (the role queues, the
  // customer's tracking page), which then just see the list and its dates.
  onDeliver?: (piece: OrderPiece) => void;
  onChangeDue?: (piece: OrderPiece, due: string) => void;
  busyPieceId?: string | null;
}

// The garments in a multi-piece order — what's gone out, what's still here,
// and when each one is due.
//
// This is the screen that answers "how many are delivered", so the count is
// stated once at the top rather than left to be inferred from the rows.
export default function OrderPiecesCard({ order, onDeliver, onChangeDue, busyPieceId = null }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const pieces = order.pieces ?? [];
  const delivered = pieces.filter((p) => p.status === "delivered").length;
  // Whether this order's garments actually come from different places.
  const mixedMaterial = new Set(pieces.map((p) => p.materialSource).filter(Boolean)).size > 1;
  const finished = order.status === "cancelled";

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3">
        <p className="section-label mb-0">Pieces</p>
        <span className="text-[13px] font-semibold text-fg tabular-nums">
          {delivered} of {pieces.length} delivered
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {pieces.map((piece, i) => {
          const isDelivered = piece.status === "delivered";
          const overdue = !isDelivered && isOrderOverdue(piece.due, order.status);
          const busy = busyPieceId === piece.id;
          return (
            <div
              key={piece.id}
              className={cn(
                "rounded-xl border px-3 py-2.5",
                isDelivered ? "border-border-soft bg-surface-4" : "border-border bg-white"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-6 h-6 shrink-0 rounded-full text-[11px] font-bold flex items-center justify-center tabular-nums",
                    isDelivered ? "bg-success-light text-success" : "bg-gold-50 text-gold-800"
                  )}
                >
                  {isDelivered ? <Check size={13} /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-[14px] font-medium min-w-0 truncate",
                    isDelivered ? "text-fg-2" : "text-fg"
                  )}
                >
                  {piece.label}
                </span>
                {/* Only when the garments differ — on a uniform order the
                    order's material line already says it, and a chip on every
                    row would be noise. */}
                {mixedMaterial && piece.materialSource && (
                  <span
                    className={cn(
                      "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide",
                      piece.materialSource === "shop"
                        ? "bg-gold-50 text-gold-800"
                        : "bg-surface-2 text-fg-3"
                    )}
                  >
                    {piece.materialSource === "shop" ? "Shop" : "Customer"}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 mt-1.5 pl-8">
                {isDelivered ? (
                  <span className="text-[12px] text-success">
                    Handed over {piece.deliveredAt ? formatDate(piece.deliveredAt) : ""}
                  </span>
                ) : editing === piece.id && onChangeDue ? (
                  <input
                    className="text-[12px] border border-border rounded-xl py-1.5 px-2 focus:outline-none focus:border-gold"
                    type="date"
                    aria-label={`${piece.label} delivery date`}
                    defaultValue={piece.due}
                    autoFocus
                    onBlur={() => setEditing(null)}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      onChangeDue(piece, e.target.value);
                      setEditing(null);
                    }}
                  />
                ) : (
                  <span
                    className={cn(
                      "text-[12px] inline-flex items-center gap-1.5",
                      overdue ? "font-semibold text-danger" : "text-fg-2"
                    )}
                  >
                    {overdue ? "Overdue · was due" : "Due"} {formatDate(piece.due)}
                    {onChangeDue && (
                      <button
                        type="button"
                        aria-label={`Change ${piece.label} delivery date`}
                        onClick={() => setEditing(piece.id)}
                        className="text-fg-2 active:scale-90 transition-transform"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </span>
                )}

                {!isDelivered && onDeliver && !finished && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDeliver(piece)}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-success text-white text-[12px] font-semibold active:scale-95 transition-transform disabled:opacity-40"
                  >
                    {busy ? "Saving…" : "Hand over"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
