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
}

export function buildOrderWhatsAppMessage(details: OrderShareDetails): string {
  const balance = details.total - details.advance;
  return [
    `Hi ${details.customer}, your order ${details.orderId} (${details.dress}) has been placed successfully at Sara Designer Studio!`,
    "",
    `Total: ${formatCurrency(details.total)}`,
    `Advance paid: ${formatCurrency(details.advance)}`,
    `Balance due: ${formatCurrency(balance > 0 ? balance : 0)}`,
    `Delivery date: ${formatDate(details.due)}`,
    "",
    "Thank you for choosing us!",
  ].join("\n");
}

// wa.me link the staff member taps "Send" on — not an automated API send.
export function buildWhatsAppShareUrl(phone: string, message: string): string {
  const digits = toIndianMobileDigits(phone);
  return `https://wa.me/91${digits}?text=${encodeURIComponent(message)}`;
}
