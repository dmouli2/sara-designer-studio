"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import StatusBadge from "@/components/orders/StatusBadge";
import MeasurementGrid from "@/components/orders/MeasurementGrid";
import ReferenceImageGallery from "@/components/orders/ReferenceImageGallery";
import { updateOrderStatus } from "@/app/actions/orders";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types";

export default function OrderDetailBody({ order: initialOrder }: { order: Order }) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [updating, setUpdating] = useState(false);

  const isCancelled = order.status === "cancelled";
  const isDone = order.status === "ready" || order.status === "delivered";

  const STATUS_BUTTONS: { status: OrderStatus; label: string; icon: string }[] = [
    { status: "stitching", label: "In Progress — Stitching", icon: "🧵" },
    { status: "ready",     label: "Mark as Ready",           icon: "✅" },
  ];

  async function handleStatus(s: OrderStatus) {
    setUpdating(true);
    const updated = await updateOrderStatus(order.id, s);
    setOrder(updated);
    setUpdating(false);
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
          <span className="text-[13px] text-[#9A9A9A]">Due {formatDate(order.due)}</span>
        </div>

        {/* Dress info */}
        <div className="card-gold">
          <p className="text-[16px] font-semibold text-[#7A6020]">{order.dress} · {order.material}</p>
          {order.notes && (
            <p className="text-[13px] text-[#A8882E]/80 mt-1.5 italic">"{order.notes}"</p>
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
        ) : !isDone ? (
          <div>
            <p className="section-label">Update status</p>
            <div className="space-y-2">
              {STATUS_BUTTONS.map(({ status, label, icon }) => (
                <button
                  key={status}
                  onClick={() => handleStatus(status)}
                  disabled={updating}
                  className={cn(
                    "w-full py-4 rounded-xl text-[14px] font-medium border active:scale-[0.98] transition-all text-left px-4 flex items-center gap-3 disabled:opacity-40",
                    order.status === status
                      ? "bg-[#0F0F0F] text-white border-[#0F0F0F] shadow-[0_4px_14px_-2px_rgba(15,15,15,0.3)]"
                      : "border-[#E5E0D5] text-[#6B6B6B] bg-white"
                  )}
                >
                  <span className="text-[17px]">{icon}</span>
                  <span>{label}</span>
                  {order.status === status && <span className="ml-auto text-[#C9A84C]">●</span>}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="card-gold text-center py-6">
            <p className="text-3xl mb-1.5">🎉</p>
            <p className="text-[16px] font-semibold text-[#1B6B3A]">Order is ready for pickup!</p>
            <p className="text-[13px] text-[#6B6B6B] mt-1">Customer will be notified</p>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
