"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import StatusBadge from "@/components/orders/StatusBadge";
import MeasurementGrid from "@/components/orders/MeasurementGrid";
import { updateOrderStatus } from "@/app/actions/orders";
import { formatDate } from "@/lib/utils";
import type { Order } from "@/types";

export default function OrderDetailBody({ order }: { order: Order }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [marking, setMarking] = useState(false);

  const alreadyDone = order.status === "cutting_done" || !["new", "cutting"].includes(order.status);

  async function handleMarkDone() {
    setMarking(true);
    await updateOrderStatus(order.id, "cutting_done");
    setMarking(false);
    setConfirmed(true);
    router.refresh();
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
          <span className="text-[13px] text-[#9A9A9A]">Due {formatDate(order.due)}</span>
        </div>

        {/* Dress & material */}
        <div className="card-gold">
          <p className="text-[16px] font-semibold text-[#7A6020]">{order.dress}</p>
          <p className="text-[14px] text-[#A8882E] mt-0.5">{order.material}</p>
          {order.notes && (
            <p className="text-[13px] text-[#A8882E]/80 mt-2 italic">"{order.notes}"</p>
          )}
        </div>

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

        {/* Reference image */}
        <div>
          <p className="section-label">Reference photo</p>
          {order.referenceImageUrl ? (
            <div className="rounded-2xl border border-[#E5E0D5] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={order.referenceImageUrl} alt="Reference" className="w-full object-cover max-h-64" loading="lazy" />
            </div>
          ) : (
            <div className="border-2 border-dashed border-[#E5E0D5] rounded-2xl p-10 text-center bg-white">
              <p className="text-3xl mb-2">📷</p>
              <p className="text-sm text-[#9A9A9A]">No reference photo</p>
            </div>
          )}
        </div>

        {/* Action */}
        {alreadyDone || confirmed ? (
          <div className="card-gold text-center py-6">
            <p className="text-3xl mb-1.5">✂️</p>
            <p className="text-[16px] font-semibold text-[#7A6020]">Cutting marked done</p>
            <p className="text-[13px] text-[#A8882E] mt-1">Admin will assign a tailor next</p>
          </div>
        ) : (
          <button onClick={handleMarkDone} disabled={marking} className="btn-gold disabled:opacity-40">
            {marking ? "Updating…" : "✓ Mark Cutting Done"}
          </button>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
