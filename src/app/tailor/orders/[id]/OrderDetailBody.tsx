"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, PartyPopper, Spool } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import Toast from "@/components/layout/Toast";
import StatusBadge from "@/components/orders/StatusBadge";
import MeasurementGrid from "@/components/orders/MeasurementGrid";
import SampleGarmentNote from "@/components/orders/SampleGarmentNote";
import { hasAnyMeasurement } from "@/lib/measurements";
import OrderPiecesCard from "@/components/orders/OrderPiecesCard";
import ReferenceImageGallery from "@/components/orders/ReferenceImageGallery";
import MaterialImageGallery from "@/components/orders/MaterialImageGallery";
import { updateOrderStatus } from "@/app/actions/orders";
import { formatDate, hasSampleGarment, isMultiPiece } from "@/lib/utils";
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
          <span className="text-[13px] text-fg-2">Due {formatDate(order.due)}</span>
        </div>

        {/* Dress info */}
        <div className="card-gold">
          <p className="text-[16px] font-semibold text-gold-800">{order.dress} · {order.material}</p>
          {order.notes && (
            <p className="text-[13px] text-accent-ink mt-1.5 italic">&quot;{order.notes}&quot;</p>
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

        {/* Measurements — an empty grid here used to be ambiguous: nothing
            said whether the numbers were missing or never taken. On a
            measurement-garment order the note comes first and whatever WAS
            written down follows it, as adjustments to the garment. */}
        <div className="space-y-3">
          <p className="section-label mb-0">Measurements</p>
          {hasSampleGarment(order) && (
            <SampleGarmentNote
              dress={order.dress}
              audience="workshop"
              hasMeasurements={hasAnyMeasurement(order.measurements)}
            />
          )}
          {(!hasSampleGarment(order) || hasAnyMeasurement(order.measurements)) && (
            <MeasurementGrid measurements={order.measurements} />
          )}
        </div>

        {/* Sketch */}
        {order.sketchDataUrl && (
          <div>
            <p className="section-label">Garment sketch</p>
            <div className="rounded-2xl border border-border overflow-hidden bg-surface">
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
          <div className="rounded-2xl border border-danger-border bg-danger-light text-center py-6">
            <Ban size={26} className="mx-auto mb-1.5 text-danger" aria-hidden="true" />
            <p className="text-[16px] font-semibold text-danger">Order cancelled</p>
          </div>
        ) : order.status === "hemming_hook" ? (
          <div className="rounded-2xl border border-info-border bg-info-light text-center py-6">
            <Spool size={26} className="mx-auto mb-1.5 text-accent-ink" aria-hidden="true" />
            <p className="text-[16px] font-semibold text-info">Sent for Hemming & Hook</p>
            <p className="text-[13px] text-info/80 mt-1">Admin will release it to Ready once finishing is done</p>
          </div>
        ) : !isHandedOff ? (
          <button onClick={handleMarkStitchingDone} disabled={marking} className="btn-gold disabled:opacity-40">
            {marking ? "Updating…" : "✓ Mark Stitching Done"}
          </button>
        ) : (
          <div className="card-gold text-center py-6">
            <PartyPopper size={26} className="mx-auto mb-1.5 text-success" aria-hidden="true" />
            <p className="text-[16px] font-semibold text-success">Order is ready for pickup!</p>
            <p className="text-[13px] text-fg-3 mt-1">Customer will be notified</p>
          </div>
        )}

        <div className="h-4" />
      </div>

      <Toast message={error} onDismiss={() => setError(null)} />
    </div>
  );
}
