"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Ban, Pencil } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import StatusBadge from "@/components/orders/StatusBadge";
import MeasurementGrid from "@/components/orders/MeasurementGrid";
import ProgressTracker from "@/components/orders/ProgressTracker";
import ReferenceImageGallery from "@/components/orders/ReferenceImageGallery";
import MaterialImageGallery from "@/components/orders/MaterialImageGallery";
import ConfirmDialog from "@/components/layout/ConfirmDialog";
import Toast from "@/components/layout/Toast";
import CancelOrderDialog from "@/components/orders/CancelOrderDialog";
import { assignMaster, assignTailor, updateOrderStatus, cancelOrder, deleteOrder } from "@/app/actions/orders";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types";
import type { StaffListItem } from "@/app/actions/staff";

// Admin can move an order to any of these directly — cancellation is
// handled separately (below) since it also needs a charge amount.
const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "new",          label: "New" },
  { value: "cutting",      label: "Cutting" },
  { value: "cutting_done", label: "Cutting Done" },
  { value: "stitching",    label: "Stitching" },
  { value: "hemming_hook", label: "Hemming & Hook" },
  { value: "ready",        label: "Ready" },
  { value: "delivered",    label: "Delivered" },
];

interface Props {
  order: Order;
  masters: StaffListItem[];
  tailors: StaffListItem[];
}

export default function AdminOrderDetailBody({ order: initialOrder, masters, tailors }: Props) {
  const router = useRouter();

  const [order, setOrder] = useState(initialOrder);
  const [assigningMaster, setAssigningMaster] = useState(false);
  const [assigningTailor, setAssigningTailor] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [releasingToReady, setReleasingToReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCancelled = order.status === "cancelled";
  // Delivered/cancelled orders are final records — no more edits.
  const canEdit = !isCancelled && order.status !== "delivered";
  const balance = order.amount - order.advance;
  const showTailorAssign = ["cutting", "cutting_done", "stitching", "hemming_hook", "ready", "delivered"].includes(
    order.status
  );

  const cancellationCharge = order.cancellationCharge ?? 0;
  const cancelBalance = cancellationCharge - order.advance;

  const SAVE_ERROR = "Couldn't save the change. Check your connection and try again.";

  async function handleReleaseToReady() {
    setReleasingToReady(true);
    try {
      const updated = await updateOrderStatus(order.id, "ready");
      setOrder(updated);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setReleasingToReady(false);
    }
  }

  // Selecting a master immediately saves and — for a brand-new order —
  // starts cutting, replacing what used to be a separate "Save assignment"
  // step. Reassigning later (order already past "new") just updates who's
  // assigned. Same pattern for tailor + "cutting_done" -> "stitching" below.
  async function handleMasterChange(masterId: string) {
    setAssigningMaster(true);
    try {
      const updated = await assignMaster(order.id, masterId || null);
      setOrder(updated);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setAssigningMaster(false);
    }
  }

  async function handleTailorChange(tailorId: string) {
    setAssigningTailor(true);
    try {
      const updated = await assignTailor(order.id, tailorId || null);
      setOrder(updated);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setAssigningTailor(false);
    }
  }

  async function handleStatusChange(status: OrderStatus) {
    setChangingStatus(true);
    try {
      const updated = await updateOrderStatus(order.id, status);
      setOrder(updated);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setChangingStatus(false);
    }
  }

  async function handleCancel(charge: number) {
    setCancelling(true);
    try {
      const updated = await cancelOrder(order.id, charge);
      setOrder(updated);
      setCancelOpen(false);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setCancelling(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteOrder(order.id);
      router.push("/admin/orders");
    } catch {
      setError("Couldn't delete the order. Check your connection and try again.");
      setDeleting(false);
      setDeleteOpen(false);
    }
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

        {canEdit && (
          <button
            onClick={() => router.push(`/admin/orders/${order.id}/edit`)}
            className="w-full flex items-center justify-center gap-2 py-3 text-[14px] font-medium text-[#0F0F0F] border border-[#E5E0D5] bg-white rounded-xl active:scale-[0.98] transition-all"
          >
            <Pencil size={16} />
            Edit order
          </button>
        )}

        {/* Material photos */}
        <div>
          <p className="section-label">Material photos</p>
          <MaterialImageGallery images={order.materialImageUrls} />
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

        {!isCancelled && (
          <>
            {/* Assign master */}
            <div>
              <p className="section-label">Assign master{assigningMaster ? " · saving…" : ""}</p>
              <select
                className="input disabled:opacity-40"
                value={order.master?.id ?? ""}
                disabled={assigningMaster}
                onChange={(e) => handleMasterChange(e.target.value)}
              >
                <option value="">Select master…</option>
                {masters.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            {showTailorAssign && (
              <div>
                <p className="section-label">Assign tailor{assigningTailor ? " · saving…" : ""}</p>
                <select
                  className="input disabled:opacity-40"
                  value={order.tailor?.id ?? ""}
                  disabled={assigningTailor}
                  onChange={(e) => handleTailorChange(e.target.value)}
                >
                  <option value="">Select tailor…</option>
                  {tailors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
          </>
        )}

        {/* Payment */}
        <div className="card">
          <p className="section-label">Payment</p>
          {isCancelled ? (
            <div className="space-y-2">
              <div className="flex justify-between items-start gap-4">
                <span className="text-[13px] text-[#9A9A9A] shrink-0">Order total</span>
                <span className="text-[14px] text-[#9A9A9A] line-through text-right">{formatCurrency(order.amount)}</span>
              </div>
              <Row label="Advance paid" value={formatCurrency(order.advance)} />
              <div className="flex justify-between pt-2 border-t border-[#F0EDE6] mt-1">
                <span className="text-[15px] font-semibold">Cancellation charge</span>
                <span className="text-[15px] font-bold text-[#B04A4A]">{formatCurrency(cancellationCharge)}</span>
              </div>
              {cancelBalance > 0 && (
                <div className="flex justify-between">
                  <span className="text-[13px] text-[#9A9A9A]">Balance due</span>
                  <span className="text-[13px] font-semibold text-[#C9A84C]">{formatCurrency(cancelBalance)}</span>
                </div>
              )}
              {cancelBalance < 0 && (
                <div className="flex justify-between">
                  <span className="text-[13px] text-[#9A9A9A]">Refund due to customer</span>
                  <span className="text-[13px] font-semibold text-[#1B6B3A]">{formatCurrency(-cancelBalance)}</span>
                </div>
              )}
            </div>
          ) : (
            <>
              {order.lineItems?.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {order.lineItems.map((li, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-[13px] text-[#6B6B6B]">
                        <span>{li.particulars} ×{li.qty} @ {formatCurrency(li.amount)}</span>
                        <span>{formatCurrency(li.qty * li.amount)}</span>
                      </div>
                      {li.note && <p className="text-[12px] text-[#A8882E] italic">({li.note})</p>}
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
            </>
          )}
        </div>

        {/* Status override — admin can jump to any status directly */}
        {!isCancelled && (
          <div>
            <p className="section-label">Order status{changingStatus ? " · updating…" : ""}</p>
            <select
              className="input disabled:opacity-40"
              value={order.status}
              disabled={changingStatus}
              onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
            >
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        )}

        {order.status === "hemming_hook" && (
          <div className="rounded-2xl border border-[#CFE0F5] bg-[#E3EEFB] p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-[#2E5C99]">Hemming & Hook pending</p>
              <p className="text-[13px] text-[#2E5C99]/80 mt-0.5">
                Order isn&apos;t ready until this finishing step is marked done.
              </p>
            </div>
            <button
              onClick={handleReleaseToReady}
              disabled={releasingToReady}
              className="w-full bg-[#2E5C99] text-white rounded-xl py-3 text-[14px] font-semibold active:opacity-80 disabled:opacity-40 transition-all"
            >
              {releasingToReady ? "Updating…" : "✓ Mark Hemming & Hook Done → Ready"}
            </button>
          </div>
        )}

        {order.status === "delivered" && (
          <div className="card-gold text-center py-5">
            <p className="text-2xl mb-1">✅</p>
            <p className="text-sm font-semibold text-[#1B6B3A]">Order delivered</p>
          </div>
        )}

        {isCancelled && (
          <div className="rounded-2xl border border-[#F0D5D5] bg-[#FBECEC] text-center py-5">
            <p className="text-2xl mb-1">🚫</p>
            <p className="text-sm font-semibold text-[#B04A4A]">Order cancelled</p>
          </div>
        )}

        {!isCancelled && (
          <button
            onClick={() => setCancelOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 text-[14px] font-medium text-[#B04A4A] border border-[#F0D5D5] rounded-xl active:scale-[0.98] transition-all"
          >
            <Ban size={18} />
            Cancel order
          </button>
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

      <CancelOrderDialog
        key={cancelOpen ? "cancel-open" : "cancel-closed"}
        open={cancelOpen}
        orderId={order.id}
        pending={cancelling}
        onConfirm={handleCancel}
        onCancel={() => setCancelOpen(false)}
      />

      <Toast message={error} onDismiss={() => setError(null)} />
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
