import { STATUS_LABELS } from "@/components/orders/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types";

// Recharts' Tooltip `formatter` passes its numeric series value through the
// library's own `ValueType` (number | string | Array<...>), never a bare
// `number` — normalize it before handing off to formatCurrency.
export function formatChartCurrency(value: number | string | readonly (number | string)[] | undefined): string {
  return formatCurrency(Number(Array.isArray(value) ? value[0] : value));
}

export type ReportDateRangePreset = "this_month" | "last_3_months" | "all_time" | "custom";

export interface ReportDateRange {
  preset: ReportDateRangePreset;
  customFrom: string;
  customTo: string;
}

export const DEFAULT_REPORT_DATE_RANGE: ReportDateRange = {
  preset: "this_month",
  customFrom: "",
  customTo: "",
};

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Resolves a preset (relative to `now`) or explicit custom bounds into a
// concrete [from, to] pair (both "YYYY-MM-DD", inclusive). Returns null for
// "all_time" — signals "no lower/upper bound" to filterOrdersByDateRange.
export function resolveDateRange(range: ReportDateRange, now: Date = new Date()): { from: string; to: string } | null {
  if (range.preset === "all_time") return null;

  if (range.preset === "custom") {
    return { from: range.customFrom || "0000-01-01", to: range.customTo || toDateOnly(now) };
  }

  const to = toDateOnly(now);
  if (range.preset === "this_month") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { from: toDateOnly(from), to };
  }

  // last_3_months
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  return { from: toDateOnly(from), to };
}

export function filterOrdersByDateRange(orders: Order[], range: ReportDateRange, now: Date = new Date()): Order[] {
  const bounds = resolveDateRange(range, now);
  if (!bounds) return orders;
  return orders.filter((o) => {
    const created = o.createdAt.slice(0, 10);
    return created >= bounds.from && created <= bounds.to;
  });
}

export interface ReportSummary {
  totalOrders: number;
  active: number;
  ready: number;
  delivered: number;
  totalRevenue: number;
  pendingBalance: number;
}

export function computeSummary(orders: Order[]): ReportSummary {
  const nonCancelled = orders.filter((o) => o.status !== "cancelled");
  return {
    totalOrders: orders.length,
    active: orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length,
    ready: orders.filter((o) => o.status === "ready").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    totalRevenue: nonCancelled.reduce((sum, o) => sum + o.amount, 0),
    pendingBalance: nonCancelled.reduce((sum, o) => sum + Math.max(o.amount - o.advance, 0), 0),
  };
}

export interface RevenuePoint {
  label: string;
  revenue: number;
}

// Groups by day when the span is short enough to stay readable on a small
// chart, otherwise falls back to month buckets (also used for "all_time",
// which has no fixed span).
export function computeRevenueTrend(orders: Order[], bounds: { from: string; to: string } | null): RevenuePoint[] {
  const nonCancelled = orders.filter((o) => o.status !== "cancelled");
  const spanDays = bounds
    ? (new Date(bounds.to).getTime() - new Date(bounds.from).getTime()) / 86_400_000
    : Infinity;
  const byMonth = spanDays > 45;

  const buckets = new Map<string, number>();
  for (const o of nonCancelled) {
    const created = o.createdAt.slice(0, 10);
    const key = byMonth ? created.slice(0, 7) : created;
    buckets.set(key, (buckets.get(key) ?? 0) + o.amount);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, revenue]) => ({
      label: byMonth
        ? new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" })
        : new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }),
      revenue,
    }));
}

export interface StatusCount {
  status: OrderStatus;
  label: string;
  count: number;
}

export function computeStatusBreakdown(orders: Order[]): StatusCount[] {
  const counts = new Map<OrderStatus, number>();
  for (const o of orders) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([status, count]) => ({ status, label: STATUS_LABELS[status], count }))
    .sort((a, b) => b.count - a.count);
}

export interface PaymentsSummary {
  advanceCollected: number;
  balanceDue: number;
}

export function computePaymentsSummary(orders: Order[]): PaymentsSummary {
  const nonCancelled = orders.filter((o) => o.status !== "cancelled");
  return {
    advanceCollected: nonCancelled.reduce((sum, o) => sum + o.advance, 0),
    balanceDue: nonCancelled.reduce((sum, o) => sum + Math.max(o.amount - o.advance, 0), 0),
  };
}

export interface DressRevenue {
  dress: string;
  revenue: number;
}

const OTHER_DRESS_BUCKET = "Other";

export function computeRevenueByDressType(orders: Order[], topN = 6): DressRevenue[] {
  const nonCancelled = orders.filter((o) => o.status !== "cancelled");
  const totals = new Map<string, number>();
  for (const o of nonCancelled) totals.set(o.dress, (totals.get(o.dress) ?? 0) + o.amount);

  const sorted = Array.from(totals.entries())
    .map(([dress, revenue]) => ({ dress, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  if (sorted.length <= topN) return sorted;

  const top = sorted.slice(0, topN);
  const otherRevenue = sorted.slice(topN).reduce((sum, d) => sum + d.revenue, 0);
  return [...top, { dress: OTHER_DRESS_BUCKET, revenue: otherRevenue }];
}

export interface StaffOrderCount {
  name: string;
  count: number;
}

const UNASSIGNED_LABEL = "Unassigned";

export function computeStaffOrderCounts(orders: Order[], role: "master" | "tailor"): StaffOrderCount[] {
  const counts = new Map<string, number>();
  for (const o of orders) {
    const staff = o[role];
    const name = staff?.name ?? UNASSIGNED_LABEL;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}
