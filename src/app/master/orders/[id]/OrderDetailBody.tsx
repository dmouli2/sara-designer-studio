"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors } from "lucide-react";
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
  const [confirmed, setConfirmed] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCancelled = order.status === "cancelled";
  const alreadyDone = !isCancelled && (order.status === "cutting_done" || !["new", "cutting"].includes(order.status));

  async function handleMarkDone() {
    setMarking(true);
    try {
      const updated = await updateOrderStatus(order.id, "cutting_done");
      setOrder(updated);
      setConfirmed(true);
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
        onBack={() => router.push("/master/queue")}
      />

      <div className="scroll-area px-4 pt-4 space-y-4">
        {/* Status */}
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          <span className="text-[13px] text-fg-2">Due {formatDate(order.due)}</span>
        </div>

        {/* Dress & material */}
        <div className="card-gold">
          <p className="text-[16px] font-semibold text-gold-800">{order.dress}</p>
          <p className="text-[14px] text-accent-ink mt-0.5">{order.material}</p>
          {order.notes && (
            <p className="text-[13px] text-accent-ink mt-2 italic">&quot;{order.notes}&quot;</p>
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
            <div className="rounded-2xl border border-border overflow-hidden bg-white">
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

        {/* Action */}
        {isCancelled ? (
          <div className="rounded-2xl border border-danger-border bg-danger-light text-center py-6">
            <p className="text-3xl mb-1.5">🚫</p>
            <p className="text-[16px] font-semibold text-danger">Order cancelled</p>
          </div>
        ) : alreadyDone || confirmed ? (
          <div className="card-gold text-center py-6">
            <Scissors size={26} className="mx-auto mb-1.5 text-accent-ink" aria-hidden="true" />
            <p className="text-[16px] font-semibold text-gold-800">Cutting marked done</p>
            <p className="text-[13px] text-accent-ink mt-1">Admin will assign a tailor next</p>
          </div>
        ) : (
          <button onClick={handleMarkDone} disabled={marking} className="btn-gold disabled:opacity-40">
            {marking ? "Updating…" : "✓ Mark Cutting Done"}
          </button>
        )}

        <div className="h-4" />
      </div>

      <Toast message={error} onDismiss={() => setError(null)} />
    </div>
  );
}
