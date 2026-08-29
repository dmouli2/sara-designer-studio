import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { AlterationRecord, Order, OrderPiece, OrderStatus, PaymentMethod } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Returns the calendar day before `dateStr` (both "YYYY-MM-DD"), computed in
// UTC so it isn't shifted by the browser's local timezone.
export function oneDayBefore(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// An order is overdue when its delivery date is before today's local calendar
// day and it hasn't already been delivered or cancelled. Compared as
// "YYYY-MM-DD" strings in local time (not UTC) so an order due yesterday
// reads as overdue from midnight IST, not from 05:30.
export function isOrderOverdue(due: string, status: OrderStatus): boolean {
  if (!due || status === "delivered" || status === "cancelled") return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return due.slice(0, 10) < today;
}

// The shop is in Dharapuram, Tamil Nadu — everything it records happens on
// an IST calendar day. Server code runs in UTC, where new Date().toISOString()
// returns yesterday's date until 05:30 IST, so an alteration taken in at
// 9pm would be filed a day early. Always date server-side events with this.
export const SHOP_TIME_ZONE = "Asia/Kolkata";

// Today in the shop's timezone as "YYYY-MM-DD" ("en-CA" is the locale whose
// short date format is exactly ISO).
export function shopToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TIME_ZONE }).format(now);
}

// Shared order-search predicate (admin list + role queues): matches on
// customer name, order id, or phone digits. An empty query matches everything.
export function matchesOrderSearch(
  order: { customer: string; phone: string; id: string },
  query: string
): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const digits = query.replace(/\D/g, "");
  return (
    order.customer.toLowerCase().includes(term) ||
    order.id.toLowerCase().includes(term) ||
    (digits.length > 0 && order.phone.replace(/\D/g, "").includes(digits))
  );
}

// Accepts a 10-digit Indian mobile number, optionally prefixed with +91, 91, or 0.
export function isValidIndianMobile(phone: string): boolean {
  const digitsOnly = phone.replace(/[\s-]/g, "");
  return /^(?:\+91|91|0)?[6-9]\d{9}$/.test(digitsOnly);
}

// Strips any country-code/leading-zero prefix, returning the bare 10-digit number.
export function toIndianMobileDigits(phone: string): string {
  const digitsOnly = phone.replace(/[\s-]/g, "");
  const match = digitsOnly.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
  return match ? match[1] : digitsOnly;
}

export interface OrderShareDetails {
  orderId: string;
  customer: string;
  dress: string;
  total: number;
  advance: number;
  due: string;
  trackingUrl: string;
}

// Same policy notes printed on the physical order form/receipt.
export const ORDER_TERMS: string[] = [
  "Firm will not be responsible for losses/damages of clothes after 1 month from the date of delivery.",
  "Delivery date can be extended for any reasons.",
  "Cancellation not available. 40% cancellation fee applies if requested.",
  "No design changes after order confirmation.",
  "We kindly request your understanding that once an order has been placed, modifications to it will not be possible.",
  "No bargaining.",
  "Alterations will be done within 2 weeks. If not possible, additional charges will apply.",
];

export function buildOrderWhatsAppMessage(details: OrderShareDetails): string {
  const balance = details.total - details.advance;
  return [
    `Hi ${details.customer}, your order ${details.orderId} (${details.dress}) has been placed successfully at Sara Designer Studio!`,
    "",
    `Total: ${formatCurrency(details.total)}`,
    `Advance paid: ${formatCurrency(details.advance)}`,
    `Balance due: ${formatCurrency(balance > 0 ? balance : 0)}`,
    `Due Date: ${formatDate(details.due)}`,
    `Reminder: Kindly call us on ${formatDate(oneDayBefore(details.due))} to confirm pickup — we can only hand over the order on time after your confirmation call.`,
    "",
    `Track your order here: ${details.trackingUrl}`,
    "",
    "Thank you for choosing us!",
    "",
    "Note:",
    ...ORDER_TERMS.map((term, i) => `${i + 1}. ${term}`),
  ].join("\n");
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
};

// The single definition of what an order still owes. Money arrives twice — the
// advance at placement and the balance collected at delivery — and forgetting
// the second term is what left every delivered order showing a balance on its
// card and counted as outstanding in Reports. Never subtract these inline.
//
// Clamped at zero: an overpayment is not a negative debt.
export function orderBalance(
  order: Pick<Order, "amount" | "advance" | "finalPayment">
): number {
  return Math.max(order.amount - order.advance - order.finalPayment, 0);
}

// Customer-facing wording for each stage the customer can be told about. The
// internal labels ("Cutting Done", "Hemming & Hook") are workshop shorthand —
// what goes to a customer's phone should read like an update, not a job-card
// field. Keyed by OrderDisplayStatus so a garment that came back for an
// alteration doesn't get told it was already delivered.
export const CUSTOMER_STATUS_LABELS: Record<OrderDisplayStatus, string> = {
  new:          "Order received",
  cutting:      "Cutting in progress",
  cutting_done: "Cutting completed",
  stitching:    "Stitching in progress",
  hemming_hook: "Hemming & hooks in progress",
  partly_delivered: "Part of your order is ready",
  ready:        "Ready for pickup",
  delivered:    "Delivered",
  cancelled:    "Cancelled",
  in_alteration:   "With us for alteration",
  alteration_done: "Alteration done — ready for pickup",
};

export interface OrderStatusShareDetails {
  orderId: string;
  customer: string;
  dress: string;
  // The display status, not the stored one — see orderDisplayStatus below.
  status: OrderDisplayStatus;
  // Already computed by the caller with orderBalance() — passing total and
  // advance would invite this builder to subtract them itself and miss the
  // payment collected at delivery.
  balance: number;
  due: string;
  trackingUrl: string;
}

// A short progress update the admin can send at any point in the order's
// life. Deliberately much shorter than buildOrderWhatsAppMessage: that one
// is the receipt sent once at placement and carries the full terms, this one
// is a nudge the customer may receive several times, so it stays to the
// status, the date, what's owed and the link.
export function buildOrderStatusWhatsAppMessage(details: OrderStatusShareDetails): string {
  const { balance } = details;
  const isReady = details.status === "ready" || details.status === "alteration_done";
  return [
    isReady
      ? `Hi ${details.customer}, good news — your order ${details.orderId} (${details.dress}) is ready for pickup at Sara Designer Studio!`
      : `Hi ${details.customer}, here's an update on your order ${details.orderId} (${details.dress}) at Sara Designer Studio.`,
    "",
    `Status: ${CUSTOMER_STATUS_LABELS[details.status]}`,
    `Delivery date: ${formatDate(details.due)}`,
    balance > 0 ? `Balance due: ${formatCurrency(balance)}` : "Fully paid — thank you!",
    "",
    `Track your order here: ${details.trackingUrl}`,
    "",
    "Thank you for choosing us!",
  ].join("\n");
}

// wa.me link the staff member taps "Send" on — not an automated API send.
export function buildWhatsAppShareUrl(phone: string, message: string): string {
  const digits = toIndianMobileDigits(phone);
  return `https://wa.me/91${digits}?text=${encodeURIComponent(message)}`;
}

// ── Multi-piece orders ──────────────────────────────────────────────────
// `pieces` is null for a single-garment order (all of them, before this
// existed). Every helper here answers correctly for that case without the
// caller having to null-check, so display code can stay unconditional.

// True only for an order deliberately split into several garments. A
// one-entry array would be a contradiction, so it doesn't count either.
export function isMultiPiece(order: Pick<Order, "pieces">): order is Pick<Order, "pieces"> & { pieces: OrderPiece[] } {
  return Array.isArray(order.pieces) && order.pieces.length > 1;
}

export function pendingPieces(order: Pick<Order, "pieces">): OrderPiece[] {
  return (order.pieces ?? []).filter((p) => p.status === "pending");
}

export function deliveredPieceCount(order: Pick<Order, "pieces">): number {
  return (order.pieces ?? []).filter((p) => p.status === "delivered").length;
}

// The date the shop is actually working towards. On a multi-piece order the
// order-level `due` is the last garment's date, so it would hide a piece
// that's overdue today — the earliest still-pending piece is what matters.
// Falls back to order.due for every single-piece order.
export function nextDueDate(order: Pick<Order, "due" | "pieces">): string {
  const pending = pendingPieces(order)
    .map((p) => p.due)
    .filter(Boolean)
    .sort();
  return pending[0] ?? order.due;
}

// ── Alterations ─────────────────────────────────────────────────────────
// The one definition of "is this order in alteration right now": the record
// that has not been handed back yet. Everything else — badges, filters,
// which button the admin sees — is derived from this.
export function openAlteration(order: Pick<Order, "alterations">): AlterationRecord | null {
  const open = (order.alterations ?? []).filter((a) => !a.redeliveredAt);
  return open.length > 0 ? open[open.length - 1] : null;
}

// What a delivered order's badge should say. Deliberately separate from
// OrderStatus: an order in alteration IS still delivered as far as the
// database, revenue and Reports are concerned — this only changes what the
// admin reads on the card.
export type OrderDisplayStatus = OrderStatus | "in_alteration" | "alteration_done";

export function orderDisplayStatus(
  order: Pick<Order, "status" | "alterations">
): OrderDisplayStatus {
  const open = openAlteration(order);
  if (!open) return order.status;
  return open.completedAt ? "alteration_done" : "in_alteration";
}
