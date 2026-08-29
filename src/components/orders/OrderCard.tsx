import { cn } from "@/lib/utils";
import {
  deliveredPieceCount,
  formatCurrency,
  formatDate,
  isMultiPiece,
  isOrderOverdue,
  nextDueDate,
  orderBalance,
} from "@/lib/utils";
import StatusBadge from "./StatusBadge";
import type { Order } from "@/types";

interface OrderCardProps {
  order: Order;
  onClick?: () => void;
  className?: string;
  showPrice?: boolean;
}

// Layout, top to bottom:
//
//   ┌────┐  B2502 ●            [ New ]     ← id + status, one line each side
//   │ 64 │  Shanmuga Priya                 ← customer, own line, truncated
//   │ px │  Blouse · Customer fabric       ← dress + material, truncated
//   └────┘
//   ✂ Not assigned   🧵 Not assigned       ← full card width, wraps cleanly
//   ─────────────────────────────────
//   Due 30 Aug 2026            ₹4,400 / Bal
//
// Two rules keep it aligned at every width from a 390pt iPhone to an iPad:
// the thumbnail is a fixed square (never `self-stretch`, which let a tall
// card drag the photo to full height), and every text run that can grow —
// customer name, material, staff names — sits on its own line inside a
// `min-w-0` column and truncates instead of wrapping. The status badge is
// the only thing allowed to hold its width, so "Cutting Done" stays on one
// line and the id never gets squeezed by it.
export default function OrderCard({ order, onClick, className, showPrice = true }: OrderCardProps) {
  const isCancelled = order.status === "cancelled";
  const balance = orderBalance(order);
  const isNew = order.status === "new";
  // On a split order the order-level due date is the LAST garment's — an
  // earlier piece can be overdue while that date is still weeks away, so the
  // card tracks the next one still in the shop. Identical to order.due for
  // every single-garment order.
  const due = nextDueDate(order);
  const overdue = isOrderOverdue(due, order.status);
  const multiPiece = isMultiPiece(order);

  return (
    <div
      onClick={onClick}
      className={cn(
        "card mb-3.5 cursor-pointer active:scale-[0.98] transition-all active:shadow-none",
        isNew && "border-l-4 border-l-[#C9A84C]",
        overdue && "border-l-4 border-l-[#B04A4A]",
        className
      )}
    >
      <div className="flex gap-3 items-start">
        {order.mainMaterialImageUrl && (
          <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl overflow-hidden border border-[#E5E0D5] shrink-0 bg-[#F0EDE6]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={order.mainMaterialImageUrl}
              alt="Material"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Id and status share a baseline; the badge never wraps or shrinks. */}
          <div className="flex items-start justify-between gap-2">
            <span className="flex items-center gap-1.5 min-w-0">
              {isNew && (
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C9A84C] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C9A84C]" />
                </span>
              )}
              <span className="text-[15px] font-semibold text-[#0F0F0F] tabular-nums tracking-tight truncate">
                {order.id}
              </span>
            </span>
            <StatusBadge status={order.status} alterations={order.alterations} />
          </div>

          <p className="text-[15px] font-medium text-[#0F0F0F] truncate mt-0.5">{order.customer}</p>

          <p className="text-[13px] text-[#6B6B6B] truncate mt-0.5">
            {order.dress} · {order.material}
          </p>
        </div>
      </div>

      {/* Below the photo column so the chips line up whether or not an order
          has a material photo. */}
      <div className="flex items-center gap-1.5 flex-wrap mt-3">
        {multiPiece && (
          <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-[#FBF6E8] text-[#7A6020] tabular-nums">
            👗 {deliveredPieceCount(order)}/{order.pieces.length} delivered
          </span>
        )}
        <span
          className={cn(
            "text-[11px] font-medium px-2 py-1 rounded-md max-w-full truncate",
            order.master ? "bg-[#F0EDE6] text-[#6B6B6B]" : "bg-[#FBECEC] text-[#B04A4A]"
          )}
        >
          ✂️ {order.master ? order.master.name : "Not assigned"}
        </span>
        <span
          className={cn(
            "text-[11px] font-medium px-2 py-1 rounded-md max-w-full truncate",
            order.tailor ? "bg-[#F0EDE6] text-[#6B6B6B]" : "bg-[#FBECEC] text-[#B04A4A]"
          )}
        >
          🧵 {order.tailor ? order.tailor.name : "Not assigned"}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-[#F0EDE6]">
        {overdue ? (
          <span className="text-[12px] font-semibold text-[#B04A4A] min-w-0 truncate">
            ⚠ Overdue · was due {formatDate(due)}
          </span>
        ) : (
          <span className="text-[12px] text-[#9A9A9A] min-w-0 truncate">Due {formatDate(due)}</span>
        )}
        {showPrice && (
          <div className="text-right shrink-0">
            {isCancelled ? (
              <>
                <p className="text-[13px] text-[#9A9A9A] line-through">{formatCurrency(order.amount)}</p>
                <p className="text-[13px] font-semibold text-[#B04A4A]">
                  {formatCurrency(order.cancellationCharge ?? 0)}
                </p>
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold text-[#0F0F0F] tabular-nums leading-none">
                  {formatCurrency(order.amount)}
                </p>
                {balance > 0 && (
                  <p className="text-[11px] text-[#C9A84C] font-medium tabular-nums mt-1">
                    Bal {formatCurrency(balance)}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
