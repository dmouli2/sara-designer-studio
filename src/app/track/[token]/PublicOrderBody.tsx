import StatusBadge from "@/components/orders/StatusBadge";
import ProgressTracker from "@/components/orders/ProgressTracker";
import ReferenceImageGallery from "@/components/orders/ReferenceImageGallery";
import MaterialImageGallery from "@/components/orders/MaterialImageGallery";
import OrderPiecesCard from "@/components/orders/OrderPiecesCard";
import TopBar from "@/components/layout/TopBar";
import { formatCurrency, formatDate, isMultiPiece, orderBalance } from "@/lib/utils";
import type { PublicOrder } from "@/lib/db";

export default function PublicOrderBody({ order }: { order: PublicOrder }) {
  const isCancelled = order.status === "cancelled";
  const balance = orderBalance(order);
  const cancellationCharge = order.cancellationCharge ?? 0;
  const cancelBalance = cancellationCharge - order.advance;

  return (
    <div className="screen">
      <TopBar title={`Order ${order.id}`} subtitle="Sara Designer Studio" />

      <div className="scroll-area px-4 pt-4 space-y-4">
        <ProgressTracker status={order.status} />

        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} alterations={order.alterations} />
          <span className="text-[13px] text-[#56524A]">Due {formatDate(order.due)}</span>
        </div>

        {/* On a split order the customer's real question is "which of mine is
            ready?" — the single order-level status can't answer it. */}
        {isMultiPiece(order) && <OrderPiecesCard order={order} />}

        <div className="card-gold">
          <p className="text-[16px] font-semibold text-[#7A6020]">{order.dress}</p>
          <p className="text-[14px] text-[#6E5518] mt-0.5">{order.material}</p>
          {order.notes && (
            <p className="text-[13px] text-[#6E5518] mt-2 italic">&quot;{order.notes}&quot;</p>
          )}
        </div>

        <div>
          <p className="section-label">Material photos</p>
          <MaterialImageGallery images={order.materialImageUrls} />
        </div>

        {order.sketchDataUrl && (
          <div>
            <p className="section-label">Garment sketch</p>
            <div className="rounded-2xl border border-[#E5E0D5] overflow-hidden bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={order.sketchDataUrl} alt="Sketch" className="w-full" loading="lazy" />
            </div>
          </div>
        )}

        <div>
          <p className="section-label">Reference photos</p>
          <ReferenceImageGallery images={order.referenceImageUrls} />
        </div>

        {order.lineItems.length > 0 && (
          <div>
            <p className="section-label">Order items</p>
            <div className="rounded-2xl border border-[#E5E0D5] overflow-hidden bg-white">
              {order.lineItems.map((li, i) => (
                <div key={i} className={`px-3 py-2.5 ${i > 0 ? "border-t border-[#F0EDE6]" : ""}`}>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#0F0F0F]">{li.particulars} ×{li.qty}</span>
                    <span className="text-[#0F0F0F] font-medium">{formatCurrency(li.qty * li.amount)}</span>
                  </div>
                  {li.note && <p className="text-xs text-[#6E5518] italic mt-0.5">({li.note})</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card-gold">
          <p className="text-xs font-semibold text-[#7A6020] mb-3">Payment</p>
          {isCancelled ? (
            <>
              <div className="flex justify-between text-sm font-bold text-[#0F0F0F]">
                <span>Order total</span>
                <span className="line-through text-[#6E5518]">{formatCurrency(order.amount)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#6B6B6B] mt-1">
                <span>Advance paid</span>
                <span>{formatCurrency(order.advance)}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-[#B04A4A] mt-1.5 pt-1.5 border-t border-[#EDD98A]">
                <span>Cancellation charge</span>
                <span>{formatCurrency(cancellationCharge)}</span>
              </div>
              {cancelBalance > 0 && (
                <div className="flex justify-between text-xs font-semibold text-[#6E5518] mt-0.5">
                  <span>Balance due</span>
                  <span>{formatCurrency(cancelBalance)}</span>
                </div>
              )}
              {cancelBalance < 0 && (
                <div className="flex justify-between text-xs font-semibold text-[#1B6B3A] mt-0.5">
                  <span>Refund due</span>
                  <span>{formatCurrency(-cancelBalance)}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-between text-sm font-bold text-[#0F0F0F]">
                <span>Total</span>
                <span>{formatCurrency(order.amount)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#6B6B6B] mt-1">
                <span>Advance paid</span>
                <span>{formatCurrency(order.advance)}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-[#6E5518] mt-0.5">
                <span>Balance due</span>
                <span>{formatCurrency(balance > 0 ? balance : 0)}</span>
              </div>
            </>
          )}
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
