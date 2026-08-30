"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import Toast from "@/components/layout/Toast";
import StatusBadge from "@/components/orders/StatusBadge";
import MeasurementGrid from "@/components/orders/MeasurementGrid";
import OrderPiecesCard from "@/components/orders/OrderPiecesCard";
import ReferenceImageGallery from "@/components/orders/ReferenceImageGallery";
import MaterialImageGallery from "@/components/orders/MaterialImageGallery";
import { updateOrderStatus } from "@/app/actions/orders";
import { formatDate, isMultiPiece } from "@/lib/utils";
import type { Order } from "@/types";

export default function OrderDetailBody({ order: initialOrder }: { order: Order }) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCancelled = order.status === "cancelled";
  // Hemming & Hook is an admin-verified finishing gate — the tailor's part
  // ends at "stitching"; they hand off rather than marking the order ready
  // themselves.
  const isHandedOff = ["hemming_hook", "ready", "delivered"].includes(order.status);

  async function handleMarkStitchingDone() {
    setMarking(true);
    try {
      const updated = await updateOrderStatus(order.id, "hemming_hook");
      setOrder(updated);
    } catch {
      setError("Couldn't save the change. Check your connection and try again.");
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="screen">
      <TopBar
        title={`${order.id} · ${order.customer}`}
        subtitle={order.dress}
        onBack={() => router.push("/tailor/queue")}
      />

      <div className="scroll-area px-4 pt-4 space-y-4">
        {/* Status */}
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          <span className="text-[13px] text-[#56524A]">Due {formatDate(order.due)}</span>
        </div>

        {/* Dress info */}
        <div className="card-gold">
          <p className="text-[16px] font-semibold text-[#7A6020]">{order.dress} · {order.material}</p>
          {order.notes && (
            <p className="text-[13px] text-[#6E5518] mt-1.5 italic">&quot;{order.notes}&quot;</p>
          )}
        </div>

        {/* Material photos */}
        <div>
          <p className="section-label">Material photos</p>
          <MaterialImageGallery images={order.materialImageUrls} />
        </div>

        {/* Several garments to the one set of measurements below, each with
            its own date — read-only here: handing them over is the admin's. */}
        {isMultiPiece(order) && <OrderPiecesCard order={order} />}

        {/* Measurements */}
        <div>
          <p className="section-label">Measurements</p>
          <MeasurementGrid measurements={order.measurements} />
        </div>

        {/* Sketch */}
        {order.sketchDataUrl && (
          <div>
            <p className="section-label">Garment sketch</p>
            <div className="rounded-2xl border border-[#E5E0D5] overflow-hidden bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={order.sketchDataUrl} alt="Sketch" className="w-full" loading="lazy" />
            </div>
          </div>
        )}

        {/* Reference photos */}
        <div>
          <p className="section-label">Reference photos</p>
          <ReferenceImageGallery images={order.referenceImageUrls} />
        </div>

        {/* Status update */}
        {isCancelled ? (
          <div className="rounded-2xl border border-[#F0D5D5] bg-[#FBECEC] text-center py-6">
            <p className="text-3xl mb-1.5">🚫</p>
            <p className="text-[16px] font-semibold text-[#B04A4A]">Order cancelled</p>
          </div>
        ) : order.status === "hemming_hook" ? (
          <div className="rounded-2xl border border-[#CFE0F5] bg-[#E3EEFB] text-center py-6">
            <p className="text-3xl mb-1.5">🪡</p>
            <p className="text-[16px] font-semibold text-[#2E5C99]">Sent for Hemming & Hook</p>
            <p className="text-[13px] text-[#2E5C99]/80 mt-1">Admin will release it to Ready once finishing is done</p>
          </div>
        ) : !isHandedOff ? (
          <button onClick={handleMarkStitchingDone} disabled={marking} className="btn-gold disabled:opacity-40">
            {marking ? "Updating…" : "✓ Mark Stitching Done"}
          </button>
        ) : (
          <div className="card-gold text-center py-6">
            <p className="text-3xl mb-1.5">🎉</p>
            <p className="text-[16px] font-semibold text-[#1B6B3A]">Order is ready for pickup!</p>
            <p className="text-[13px] text-[#6B6B6B] mt-1">Customer will be notified</p>
          </div>
        )}

        <div className="h-4" />
      </div>

      <Toast message={error} onDismiss={() => setError(null)} />
    </div>
  );
}
