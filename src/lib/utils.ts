import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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

// wa.me link the staff member taps "Send" on — not an automated API send.
export function buildWhatsAppShareUrl(phone: string, message: string): string {
  const digits = toIndianMobileDigits(phone);
  return `https://wa.me/91${digits}?text=${encodeURIComponent(message)}`;
}
