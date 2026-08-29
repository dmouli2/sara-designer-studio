"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Ban, Pencil, MessageCircle } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import StatusBadge from "@/components/orders/StatusBadge";
import MeasurementGrid from "@/components/orders/MeasurementGrid";
import ProgressTracker from "@/components/orders/ProgressTracker";
import ReferenceImageGallery from "@/components/orders/ReferenceImageGallery";
import MaterialImageGallery from "@/components/orders/MaterialImageGallery";
import ConfirmDialog from "@/components/layout/ConfirmDialog";
import Toast from "@/components/layout/Toast";
import CancelOrderDialog from "@/components/orders/CancelOrderDialog";
import DeliverOrderDialog from "@/components/orders/DeliverOrderDialog";
import DeliverPieceDialog from "@/components/orders/DeliverPieceDialog";
import OrderPiecesCard from "@/components/orders/OrderPiecesCard";
import AlterationPanel from "@/components/orders/AlterationPanel";
import StartAlterationDialog from "@/components/orders/StartAlterationDialog";
import {
  assignMaster,
  assignTailor,
  updateOrderStatus,
  deliverOrder,
  deliverPiece,
  updatePieceDue,
  startAlteration,
  completeAlteration,
  redeliverAlteration,
  cancelOrder,
  deleteOrder,
  type StartAlterationInput,
} from "@/app/actions/orders";
import {
  formatCurrency,
  formatDate,
  isMultiPiece,
  openAlteration,
  orderDisplayStatus,
  orderBalance,
  pendingPieces,
  PAYMENT_METHOD_LABELS,
  buildOrderStatusWhatsAppMessage,
  buildWhatsAppShareUrl,
} from "@/lib/utils";
import type { Order, OrderPiece, OrderStatus, PaymentMethod } from "@/types";
import type { StaffListItem } from "@/app/actions/staff";

// Admin can move an order to any of these directly — cancellation is
// handled separately (below) since it also needs a charge amount.
// "Delivered" opens the delivery dialog rather than setting the status
// directly. "Part Delivered" is listed but never selectable — it exists so a
// partly delivered order's dropdown shows its real state instead of going
// blank; it is written only by handing an individual piece over.
const STATUS_OPTIONS: { value: OrderStatus; label: string; selectable?: boolean }[] = [
  { value: "new",              label: "New" },
  { value: "cutting",          label: "Cutting" },
  { value: "cutting_done",     label: "Cutting Done" },
  { value: "stitching",        label: "Stitching" },
  { value: "hemming_hook",     label: "Hemming & Hook" },
  { value: "ready",            label: "Ready" },
  { value: "partly_delivered", label: "Part Delivered", selectable: false },
  { value: "delivered",        label: "Delivered" },
];

interface Props {
  order: Order;
  masters: StaffListItem[];
  tailors: StaffListItem[];
  // The order's customer-tracking token, supplied by the page. Null only for
  // rows predating public tokens — the share button hides rather than
  // sending a broken link.
  shareToken?: string | null;
}

export default function AdminOrderDetailBody({
  order: initialOrder,
  masters,
  tailors,
  shareToken = null,
}: Props) {
  const router = useRouter();

  const [order, setOrder] = useState(initialOrder);
  const [assigningMaster, setAssigningMaster] = useState(false);
  const [assigningTailor, setAssigningTailor] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [deliverPieceTarget, setDeliverPieceTarget] = useState<OrderPiece | null>(null);
  const [busyPieceId, setBusyPieceId] = useState<string | null>(null);
  const [alterationOpen, setAlterationOpen] = useState(false);
  const [alterationPending, setAlterationPending] = useState(false);
  const [releasingToReady, setReleasingToReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCancelled = order.status === "cancelled";
  const multiPiece = isMultiPiece(order);
  // Re-shareable at any point in the order's life, not just at placement.
  // Hidden for a cancelled order, where a progress update makes no sense.
  const canShareStatus = !isCancelled && !!shareToken;
  // Delivered/cancelled orders are final records — no more edits. A partly
  // delivered order is still in progress, so it stays editable.
  const canEdit = !isCancelled && order.status !== "delivered";
  const balance = orderBalance(order);
  const showTailorAssign = [
    "cutting", "cutting_done", "stitching", "hemming_hook", "ready", "partly_delivered", "delivered",
  ].includes(order.status);

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
    // Delivering has to collect the balance first — the dialog does it, and
    // deliverOrder is the only action that can set this status.
    if (status === "delivered") {
      setDeliverOpen(true);
      return;
    }
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

  async function handleDeliver(method: PaymentMethod, deliveredOn: string) {
    setDelivering(true);
    try {
      const updated = await deliverOrder(order.id, method, deliveredOn);
      setOrder(updated);
      setDeliverOpen(false);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setDelivering(false);
    }
  }

  async function handleDeliverPiece(
    collect: { amount: number; method: PaymentMethod } | undefined,
    handedOverOn: string
  ) {
    const piece = deliverPieceTarget;
    if (!piece) return;
    setBusyPieceId(piece.id);
    try {
      const updated = await deliverPiece(order.id, piece.id, collect, handedOverOn);
      setOrder(updated);
      setDeliverPieceTarget(null);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusyPieceId(null);
    }
  }

  async function handlePieceDueChange(piece: OrderPiece, due: string) {
    setBusyPieceId(piece.id);
    try {
      setOrder(await updatePieceDue(order.id, piece.id, due));
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusyPieceId(null);
    }
  }

  // The three alteration steps share one pending flag: only ever one of them
  // is on screen at a time.
  async function runAlterationStep(step: () => Promise<Order>, onDone?: () => void) {
    setAlterationPending(true);
    try {
      setOrder(await step());
      onDone?.();
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setAlterationPending(false);
    }
  }

  function handleStartAlteration(input: StartAlterationInput) {
    return runAlterationStep(() => startAlteration(order.id, input), () => setAlterationOpen(false));
  }

  // Opens WhatsApp with the message prefilled — the admin still taps Send.
  // Nothing is stored and no order state changes, so this is safe to use as
  // many times as the customer asks.
  function handleShareStatus() {
    if (!shareToken) return;
    const message = buildOrderStatusWhatsAppMessage({
      orderId: order.id,
      customer: order.customer,
      dress: order.dress,
      // What the customer should be told, which is not always the stored
      // status: an order in alteration is stored as delivered.
      status: orderDisplayStatus(order),
      balance,
      due: order.due,
      trackingUrl: `${window.location.origin}/track/${shareToken}`,
    });
    window.open(buildWhatsAppShareUrl(order.phone, message), "_blank");
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
          <StatusBadge status={order.status} alterations={order.alterations} />
          <span className="text-[13px] text-[#9A9A9A]">Due {formatDate(order.due)}</span>
        </div>

        {canShareStatus && (
          <button
            type="button"
            onClick={handleShareStatus}
            className="w-full flex items-center justify-center gap-2 py-3 text-[14px] font-semibold text-[#1B6B3A] border border-[#BFE3CE] bg-[#F4FBF7] rounded-xl active:scale-[0.98] transition-all"
          >
            <MessageCircle size={16} />
            Share status with customer
          </button>
        )}

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

        {multiPiece && (
          <OrderPiecesCard
            order={order}
            busyPieceId={busyPieceId}
            onDeliver={isCancelled ? undefined : (piece) => setDeliverPieceTarget(piece)}
            onChangeDue={isCancelled ? undefined : handlePieceDueChange}
          />
        )}

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
                <Row label="Order total" value={formatCurrency(order.amount)} />
                <Row
                  label="Advance paid"
                  value={`${formatCurrency(order.advance)}${
                    order.advanceMethod ? ` · ${PAYMENT_METHOD_LABELS[order.advanceMethod]}` : ""
                  }`}
                />
                {order.finalPayment > 0 && (
                  <Row
                    label={multiPiece ? "Collected since" : "Collected on delivery"}
                    value={`${formatCurrency(order.finalPayment)}${
                      order.finalPaymentMethod
                        ? ` · ${PAYMENT_METHOD_LABELS[order.finalPaymentMethod]}`
                        : " · method not recorded"
                    }`}
                  />
                )}
                {/* The ledger only has something to add when money arrived in
                    more than one instalment — otherwise the row above already
                    says everything. */}
                {(order.payments ?? []).length > 1 && (
                  <div className="pl-3 border-l-2 border-[#F0EDE6] space-y-1 py-0.5">
                    {order.payments.map((payment) => (
                      <div key={payment.id} className="flex justify-between text-[12px] text-[#9A9A9A]">
                        <span className="min-w-0 truncate">
                          {formatDate(payment.at)}
                          {payment.pieceId
                            ? ` · ${order.pieces?.find((p) => p.id === payment.pieceId)?.label ?? "piece"}`
                            : ""}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {formatCurrency(payment.amount)} · {PAYMENT_METHOD_LABELS[payment.method]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value} disabled={s.selectable === false}>
                  {s.label}
                </option>
              ))}
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

        {order.status === "delivered" && !openAlteration(order) && (
          <div className="card-gold text-center py-5">
            <p className="text-2xl mb-1">✅</p>
            <p className="text-sm font-semibold text-[#1B6B3A]">
              Order delivered{order.deliveredOn ? ` ${formatDate(order.deliveredOn)}` : ""}
            </p>
          </div>
        )}

        {!isCancelled && (
          <AlterationPanel
            order={order}
            pending={alterationPending}
            onStart={() => setAlterationOpen(true)}
            onComplete={(on) => runAlterationStep(() => completeAlteration(order.id, on))}
            onRedeliver={(on) => runAlterationStep(() => redeliverAlteration(order.id, on))}
          />
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

      <DeliverOrderDialog
        key={deliverOpen ? "deliver-open" : "deliver-closed"}
        open={deliverOpen}
        orderId={order.id}
        balance={balance}
        pending={delivering}
        onConfirm={handleDeliver}
        onCancel={() => setDeliverOpen(false)}
      />

      {deliverPieceTarget && (
        <DeliverPieceDialog
          key={deliverPieceTarget.id}
          open
          piece={deliverPieceTarget}
          balance={balance}
          isLast={pendingPieces(order).length === 1}
          pending={busyPieceId === deliverPieceTarget.id}
          onConfirm={handleDeliverPiece}
          onCancel={() => setDeliverPieceTarget(null)}
        />
      )}

      <StartAlterationDialog
        key={alterationOpen ? "alteration-open" : "alteration-closed"}
        open={alterationOpen}
        orderId={order.id}
        pieces={order.pieces}
        pending={alterationPending}
        onConfirm={handleStartAlteration}
        onCancel={() => setAlterationOpen(false)}
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
