import { describe, it, expect } from "vitest";
import {
  resolveDateRange,
  filterOrdersByDateRange,
  computeSummary,
  computeRevenueTrend,
  computeStatusBreakdown,
  computePaymentsSummary,
  computeRevenueByDressType,
  computeStaffOrderCounts,
  formatChartCurrency,
  DEFAULT_REPORT_DATE_RANGE,
  type ReportDateRange,
} from "./reports";
import type { Order } from "@/types";

const NOW = new Date("2026-07-15T12:00:00Z");

function order(overrides: Partial<Order>): Order {
  return {
    id: "SDS-001",
    customer: "Priya",
    phone: "9876543210",
    dress: "Blouse",
    material: "Silk",
    status: "new",
    amount: 1000,
    advance: 300,
    advanceMethod: null,
    advanceSplit: null,
    finalPayment: 0,
    finalPaymentMethod: null,
    due: "2026-07-20",
    master: null,
    tailor: null,
    measurements: { type: "generic", bust: "", waist: "", hip: "", length: "", shoulder: "", sleeve: "", neckDepth: "", armRound: "" },
    lineItems: [],
    notes: "",
    sketchDataUrl: null,
    referenceImageUrls: [],
    materialImageUrls: [],
    mainMaterialImageUrl: null,
    cancellationCharge: null,
    deliveredOn: null,
    pieces: null,
    alterations: [],
    payments: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveDateRange", () => {
  it("resolves this_month to the 1st of the current month through today", () => {
    expect(resolveDateRange({ ...DEFAULT_REPORT_DATE_RANGE, preset: "this_month" }, NOW)).toEqual({
      from: "2026-07-01",
      to: "2026-07-15",
    });
  });

  it("resolves last_3_months to the 1st of the month two months back", () => {
    expect(resolveDateRange({ ...DEFAULT_REPORT_DATE_RANGE, preset: "last_3_months" }, NOW)).toEqual({
      from: "2026-05-01",
      to: "2026-07-15",
    });
  });

  it("returns null for all_time", () => {
    expect(resolveDateRange({ ...DEFAULT_REPORT_DATE_RANGE, preset: "all_time" }, NOW)).toBeNull();
  });

  it("resolves custom to the explicit from/to bounds", () => {
    const range: ReportDateRange = { preset: "custom", customFrom: "2026-01-01", customTo: "2026-02-01" };
    expect(resolveDateRange(range, NOW)).toEqual({ from: "2026-01-01", to: "2026-02-01" });
  });

  it("falls back to sensible defaults when custom bounds are left blank", () => {
    const range: ReportDateRange = { preset: "custom", customFrom: "", customTo: "" };
    expect(resolveDateRange(range, NOW)).toEqual({ from: "0000-01-01", to: "2026-07-15" });
  });
});

describe("filterOrdersByDateRange", () => {
  const orders = [
    order({ id: "A", createdAt: "2026-06-01T00:00:00.000Z" }),
    order({ id: "B", createdAt: "2026-07-10T00:00:00.000Z" }),
    order({ id: "C", createdAt: "2026-08-01T00:00:00.000Z" }),
  ];

  it("keeps only orders created within the resolved bounds", () => {
    const result = filterOrdersByDateRange(orders, { ...DEFAULT_REPORT_DATE_RANGE, preset: "this_month" }, NOW);
    expect(result.map((o) => o.id)).toEqual(["B"]);
  });

  it("returns every order for all_time", () => {
    const result = filterOrdersByDateRange(orders, { ...DEFAULT_REPORT_DATE_RANGE, preset: "all_time" }, NOW);
    expect(result).toHaveLength(3);
  });
});

describe("computeSummary", () => {
  const orders = [
    order({ id: "A", status: "new", amount: 1000, advance: 300 }),
    order({ id: "B", status: "ready", amount: 2000, advance: 2000 }),
    order({ id: "C", status: "delivered", amount: 1500, advance: 1500 }),
    order({ id: "D", status: "cancelled", amount: 5000, advance: 500 }),
  ];

  it("counts totals, active, ready and delivered", () => {
    const summary = computeSummary(orders);
    expect(summary.totalOrders).toBe(4);
    expect(summary.active).toBe(2); // "new" and "ready" (cancelled/delivered excluded)
    expect(summary.ready).toBe(1);
    expect(summary.delivered).toBe(1);
  });

  it("excludes cancelled orders from revenue and pending balance", () => {
    const summary = computeSummary(orders);
    expect(summary.totalRevenue).toBe(1000 + 2000 + 1500);
    expect(summary.pendingBalance).toBe(700); // only A has a balance (1000-300)
  });

  it("floors pending balance at zero per order", () => {
    const summary = computeSummary([order({ status: "new", amount: 1000, advance: 1500 })]);
    expect(summary.pendingBalance).toBe(0);
  });
});

describe("computeRevenueTrend", () => {
  it("groups by day when the span is 45 days or less", () => {
    const orders = [
      order({ createdAt: "2026-07-01T00:00:00.000Z", amount: 500 }),
      order({ createdAt: "2026-07-01T00:00:00.000Z", amount: 500 }),
      order({ createdAt: "2026-07-02T00:00:00.000Z", amount: 300 }),
    ];
    const points = computeRevenueTrend(orders, { from: "2026-07-01", to: "2026-07-15" });
    expect(points).toEqual([
      { label: "1 Jul", revenue: 1000 },
      { label: "2 Jul", revenue: 300 },
    ]);
  });

  it("groups by month when the span exceeds 45 days", () => {
    const orders = [
      order({ createdAt: "2026-06-05T00:00:00.000Z", amount: 400 }),
      order({ createdAt: "2026-07-10T00:00:00.000Z", amount: 600 }),
    ];
    const points = computeRevenueTrend(orders, { from: "2026-01-01", to: "2026-07-15" });
    expect(points).toEqual([
      { label: "Jun 26", revenue: 400 },
      { label: "Jul 26", revenue: 600 },
    ]);
  });

  it("groups by month for an unbounded (all_time) range", () => {
    const orders = [order({ createdAt: "2026-07-10T00:00:00.000Z", amount: 600 })];
    const points = computeRevenueTrend(orders, null);
    expect(points).toEqual([{ label: "Jul 26", revenue: 600 }]);
  });

  it("excludes cancelled orders", () => {
    const orders = [
      order({ createdAt: "2026-07-01T00:00:00.000Z", amount: 500, status: "cancelled" }),
      order({ createdAt: "2026-07-01T00:00:00.000Z", amount: 300, status: "new" }),
    ];
    const points = computeRevenueTrend(orders, { from: "2026-07-01", to: "2026-07-10" });
    expect(points).toEqual([{ label: "1 Jul", revenue: 300 }]);
  });
});

describe("computeStatusBreakdown", () => {
  it("counts orders per status, sorted by count descending", () => {
    const orders = [
      order({ status: "new" }),
      order({ status: "new" }),
      order({ status: "ready" }),
    ];
    expect(computeStatusBreakdown(orders)).toEqual([
      { status: "new", label: "New", count: 2 },
      { status: "ready", label: "Ready", count: 1 },
    ]);
  });
});

describe("computePaymentsSummary", () => {
  it("sums advance collected and balance due, excluding cancelled orders", () => {
    const orders = [
      order({ status: "new", amount: 1000, advance: 300 }),
      order({ status: "ready", amount: 2000, advance: 2000 }),
      order({ status: "cancelled", amount: 5000, advance: 1000 }),
    ];
    expect(computePaymentsSummary(orders)).toEqual({
      advanceCollected: 2300,
      collectedOnDelivery: 0,
      balanceDue: 700,
    });
  });

  // The bug this whole payment split exists to fix: a delivered order was
  // counted as still owing its full balance forever, because nothing ever
  // recorded the money handed over at the counter.
  it("stops counting a delivered order as outstanding once its balance is collected", () => {
    const orders = [
      order({ status: "delivered", amount: 3000, advance: 500, finalPayment: 2500, finalPaymentMethod: "cash" }),
      order({ status: "new", amount: 1000, advance: 0 }),
    ];
    expect(computePaymentsSummary(orders)).toEqual({
      advanceCollected: 500,
      collectedOnDelivery: 2500,
      balanceDue: 1000, // only the undelivered order
    });
  });

  it("counts the delivery payment in the report summary's pending balance too", () => {
    const settled = order({ status: "delivered", amount: 3000, advance: 0, finalPayment: 3000 });
    expect(computeSummary([settled]).pendingBalance).toBe(0);
  });
});

describe("computeRevenueByDressType", () => {
  it("returns dress types sorted by revenue with no Other bucket when within topN", () => {
    const orders = [
      order({ dress: "Blouse", amount: 1000 }),
      order({ dress: "Salwar", amount: 2000 }),
    ];
    expect(computeRevenueByDressType(orders, 6)).toEqual([
      { dress: "Salwar", revenue: 2000 },
      { dress: "Blouse", revenue: 1000 },
    ]);
  });

  it("buckets everything past topN into an Other entry", () => {
    const orders = [
      order({ dress: "A", amount: 500 }),
      order({ dress: "B", amount: 400 }),
      order({ dress: "C", amount: 300 }),
    ];
    expect(computeRevenueByDressType(orders, 2)).toEqual([
      { dress: "A", revenue: 500 },
      { dress: "B", revenue: 400 },
      { dress: "Other", revenue: 300 },
    ]);
  });

  it("excludes cancelled orders from dress-type revenue", () => {
    const orders = [order({ dress: "Blouse", amount: 1000, status: "cancelled" })];
    expect(computeRevenueByDressType(orders)).toEqual([]);
  });
});

describe("formatChartCurrency", () => {
  it("formats a plain number", () => {
    expect(formatChartCurrency(4200)).toBe("₹4,200");
  });

  it("formats a numeric string, as recharts passes for some series", () => {
    expect(formatChartCurrency("4200")).toBe("₹4,200");
  });

  it("formats the first element when given a range tuple", () => {
    expect(formatChartCurrency([1000, 2000])).toBe("₹1,000");
  });
});

describe("computeStaffOrderCounts", () => {
  it("counts orders per master and buckets unassigned orders", () => {
    const orders = [
      order({ master: { id: "m1", name: "Ramesh K." } }),
      order({ master: { id: "m1", name: "Ramesh K." } }),
      order({ master: null }),
    ];
    expect(computeStaffOrderCounts(orders, "master")).toEqual([
      { name: "Ramesh K.", count: 2 },
      { name: "Unassigned", count: 1 },
    ]);
  });

  it("counts orders per tailor independently of master", () => {
    const orders = [
      order({ tailor: { id: "t1", name: "Anitha K." } }),
      order({ tailor: { id: "t2", name: "Suresh P." } }),
    ];
    expect(computeStaffOrderCounts(orders, "tailor")).toEqual([
      { name: "Anitha K.", count: 1 },
      { name: "Suresh P.", count: 1 },
    ]);
  });
});
