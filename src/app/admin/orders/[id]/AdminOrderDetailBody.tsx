"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import StatusBadge from "@/components/orders/StatusBadge";
import MeasurementGrid from "@/components/orders/MeasurementGrid";
import ProgressTracker from "@/components/orders/ProgressTracker";
import ConfirmDialog from "@/components/layout/ConfirmDialog";
import { assignStaff, updateOrderStatus, deleteOrder } from "@/app/actions/orders";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types";
import type { StaffListItem } from "@/app/actions/staff";

const STATUS_TRANSITIONS: { from: OrderStatus[]; to: OrderStatus; label: string }[] = [
  { from: ["new"],          to: "cutting",   label: "Move to Cutting" },
  { from: ["cutting_done"], to: "stitching", label: "Move to Stitching" },
  { from: ["stitching"],    to: "ready",     label: "Mark Ready for Pickup" },
  { from: ["ready"],        to: "delivered", label: "Mark as Delivered" },
];

interface Props {
  order: Order;
  masters: StaffListItem[];
  tailors: StaffListItem[];
}

export default function AdminOrderDetailBody({ order: initialOrder, masters, tailors }: Props) {
  const router = useRouter();

  const [order, setOrder] = useState(initialOrder);
  const [masterId, setMasterId] = useState(order.master?.id ?? "");
  const [tailorId, setTailorId] = useState(order.tailor?.id ?? "");
  const [saved, setSaved]       = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const balance = order.amount - order.advance;
  const availableTransition = STATUS_TRANSITIONS.find((t) => t.from.includes(order.status));
  const showTailorAssign = ["cutting", "cutting_done", "stitching", "ready", "delivered"].includes(order.status);

  async function handleAssign() {
    setAssigning(true);
    const updated = await assignStaff(order.id, masterId || null, tailorId || null);
    setOrder(updated);
    setAssigning(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleStatusChange(to: OrderStatus) {
    setChangingStatus(true);
    const updated = await updateOrderStatus(order.id, to);
    setOrder(updated);
    setChangingStatus(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await deleteOrder(order.id);
    router.push("/admin/orders");
  }

  return (
    <div className="screen">
      <TopBar
        title={order.id}
        subtitle={`${order.customer} · ${order.dress}`}
        onBack={() => router.push("/admin/orders")}
      />

      <div className="scroll-area px-4 pt-4 space-y-4">
        {/* Progress */}
        <div className="card">
          <p className="section-label">Order progress</p>
          <ProgressTracker status={order.status} />
        </div>

        {/* Status + date */}
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          <span className="text-[13px] text-[#9A9A9A]">Due {formatDate(order.due)}</span>
        </div>

        {/* Order info */}
        <div className="card">
          <p className="section-label">Order details</p>
          <div className="space-y-2">
            <Row label="Customer" value={order.customer} />
            <Row label="Phone"    value={order.phone} />
            <Row label="Dress"    value={order.dress} />
            <Row label="Material" value={order.material} />
            {order.notes && <Row label="Notes" value={order.notes} />}
          </div>
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
            <div className="border-2 border-dashed border-[#E5E0D5] rounded-2xl p-8 text-center bg-white">
              <p className="text-3xl mb-2">📷</p>
              <p className="text-sm text-[#9A9A9A]">No reference photo attached</p>
            </div>
          )}
        </div>

        {/* Assign master */}
        <div>
          <p className="section-label">Assign master</p>
          <select className="input" value={masterId} onChange={(e) => setMasterId(e.target.value)}>
            <option value="">Select master…</option>
            {masters.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        {showTailorAssign && (
          <div>
            <p className="section-label">Assign tailor</p>
            <select className="input" value={tailorId} onChange={(e) => setTailorId(e.target.value)}>
              <option value="">Select tailor…</option>
              {tailors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        <button onClick={handleAssign} disabled={assigning} className="btn-outline disabled:opacity-40">
          {assigning ? "Saving…" : saved ? "✓ Saved!" : "Save Assignment"}
        </button>

        {/* Payment */}
        <div className="card">
          <p className="section-label">Payment</p>
          {order.lineItems?.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {order.lineItems.map((li, i) => (
                <div key={i} className="flex justify-between text-[13px] text-[#6B6B6B]">
                  <span>{li.particulars} ×{li.qty}</span>
                  <span>{formatCurrency(li.amount)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <Row label="Order total"  value={formatCurrency(order.amount)} />
            <Row label="Advance paid" value={formatCurrency(order.advance)} />
            <div className="flex justify-between pt-2 border-t border-[#F0EDE6] mt-1">
              <span className="text-[15px] font-semibold">Balance due</span>
              <span className={`text-[15px] font-bold ${balance > 0 ? "text-[#C9A84C]" : "text-[#1B6B3A]"}`}>
                {formatCurrency(balance > 0 ? balance : 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Status transition */}
        {availableTransition && order.status !== "delivered" && (
          <button
            onClick={() => handleStatusChange(availableTransition.to)}
            disabled={changingStatus}
            className="btn-gold disabled:opacity-40"
          >
            {changingStatus ? "Updating…" : `${availableTransition.label} →`}
          </button>
        )}

        {order.status === "delivered" && (
          <div className="card-gold text-center py-5">
            <p className="text-2xl mb-1">✅</p>
            <p className="text-sm font-semibold text-[#1B6B3A]">Order delivered</p>
          </div>
        )}

        <button
          onClick={() => setDeleteOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 text-[14px] font-medium text-[#B04A4A] active:scale-[0.98] transition-all"
        >
          <Trash2 size={18} />
          Delete order
        </button>

        <div className="h-4" />
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this order?"
        message={`This permanently deletes order ${order.id} for ${order.customer}. This cannot be undone.`}
        confirmLabel="Delete permanently"
        destructive
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-[13px] text-[#9A9A9A] shrink-0">{label}</span>
      <span className="text-[14px] text-[#0F0F0F] text-right">{value}</span>
    </div>
  );
}
