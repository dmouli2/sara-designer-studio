import { describe, it, expect, vi, afterEach } from "vitest";
import {
  cn,
  formatCurrency,
  formatDate,
  oneDayBefore,
  isOrderOverdue,
  matchesOrderSearch,
  isValidIndianMobile,
  toIndianMobileDigits,
  buildOrderWhatsAppMessage,
  buildOrderStatusWhatsAppMessage,
  orderBalance,
  PAYMENT_METHOD_LABELS,
  buildWhatsAppShareUrl,
  CUSTOMER_STATUS_LABELS,
  ORDER_TERMS,
  isMultiPiece,
  pendingPieces,
  deliveredPieceCount,
  nextDueDate,
  openAlteration,
  orderDisplayStatus,
  shopToday,
} from "./utils";
import type { AlterationRecord, OrderPiece } from "@/types";

function piece(over: Partial<OrderPiece> = {}): OrderPiece {
  return { id: "p1", label: "Blouse 1", due: "2026-09-01", status: "pending", deliveredAt: null, ...over };
}

function alteration(over: Partial<AlterationRecord> = {}): AlterationRecord {
  return {
    id: "a1",
    reason: "Sleeve tight",
    pieceLabel: null,
    receivedAt: "2026-08-01",
    promisedAt: "2026-08-08",
    completedAt: null,
    redeliveredAt: null,
    ...over,
  };
}

describe("shopToday", () => {
  // Server code runs in UTC, where an evening in Dharapuram is still
  // "yesterday" — the whole reason this helper exists.
  it("dates an IST evening as that IST day, not the UTC one", () => {
    expect(shopToday(new Date("2026-08-29T20:30:00Z"))).toBe("2026-08-30");
  });

  it("returns an ISO calendar date", () => {
    expect(shopToday(new Date("2026-08-29T09:00:00Z"))).toBe("2026-08-29");
  });
});

describe("multi-piece helpers", () => {
  // Null is "this order is one garment", not "no garments" — and a
  // one-entry array would be a contradiction, so neither counts as split.
  it("only treats a genuinely split order as multi-piece", () => {
    expect(isMultiPiece({ pieces: null })).toBe(false);
    expect(isMultiPiece({ pieces: [piece()] })).toBe(false);
    expect(isMultiPiece({ pieces: [piece(), piece({ id: "p2" })] })).toBe(true);
  });

  it("counts what has gone out and what is still here", () => {
    const order = {
      pieces: [piece(), piece({ id: "p2", status: "delivered", deliveredAt: "2026-08-20" })],
    };
    expect(deliveredPieceCount(order)).toBe(1);
    expect(pendingPieces(order).map((p) => p.id)).toEqual(["p1"]);
  });

  it("answers zero and empty for a single-garment order", () => {
    expect(deliveredPieceCount({ pieces: null })).toBe(0);
    expect(pendingPieces({ pieces: null })).toEqual([]);
  });

  describe("nextDueDate", () => {
    it("falls back to the order's date when there are no pieces", () => {
      expect(nextDueDate({ due: "2026-09-30", pieces: null })).toBe("2026-09-30");
    });

    // The order-level date is the LAST garment's, so an earlier piece can be
    // overdue while it is still weeks away.
    it("returns the earliest piece still in the shop", () => {
      expect(
        nextDueDate({
          due: "2026-09-30",
          pieces: [
            piece({ id: "p1", due: "2026-09-20" }),
            piece({ id: "p2", due: "2026-09-05" }),
            piece({ id: "p3", due: "2026-09-01", status: "delivered" }),
          ],
        })
      ).toBe("2026-09-05");
    });

    it("falls back to the order's date once every piece has gone", () => {
      expect(
        nextDueDate({
          due: "2026-09-30",
          pieces: [piece({ status: "delivered" })],
        })
      ).toBe("2026-09-30");
    });

    it("ignores a piece with no date of its own", () => {
      expect(
        nextDueDate({ due: "2026-09-30", pieces: [piece({ due: "" })] })
      ).toBe("2026-09-30");
    });
  });
});

describe("openAlteration / orderDisplayStatus", () => {
  it("finds nothing on an order that never came back", () => {
    expect(openAlteration({ alterations: [] })).toBeNull();
    expect(orderDisplayStatus({ status: "delivered", alterations: [] })).toBe("delivered");
  });

  it("ignores a closed record", () => {
    expect(openAlteration({ alterations: [alteration({ redeliveredAt: "2026-08-10" })] })).toBeNull();
  });

  it("reports the record still with us, newest first", () => {
    const open = alteration({ id: "a2" });
    expect(
      openAlteration({ alterations: [alteration({ redeliveredAt: "2026-07-01" }), open] })?.id
    ).toBe("a2");
  });

  // The order stays "delivered" in the database throughout — only the badge
  // changes, which is what keeps revenue and the delivered count intact.
  it("shows the alteration state in place of the stored status", () => {
    expect(orderDisplayStatus({ status: "delivered", alterations: [alteration()] })).toBe("in_alteration");
    expect(
      orderDisplayStatus({ status: "delivered", alterations: [alteration({ completedAt: "2026-08-05" })] })
    ).toBe("alteration_done");
  });
});



describe("isOrderOverdue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("flags an active order whose due date has passed", () => {
    expect(isOrderOverdue("2020-01-01", "cutting")).toBe(true);
  });

  it("does not flag an order due today or later", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 3, 12, 0, 0)); // 3 Jul 2026 local
    expect(isOrderOverdue("2026-07-03", "cutting")).toBe(false);
    expect(isOrderOverdue("2026-07-04", "new")).toBe(false);
    // Compared as local calendar days: yesterday is overdue from midnight.
    expect(isOrderOverdue("2026-07-02", "stitching")).toBe(true);
  });

  it("never flags delivered or cancelled orders", () => {
    expect(isOrderOverdue("2020-01-01", "delivered")).toBe(false);
    expect(isOrderOverdue("2020-01-01", "cancelled")).toBe(false);
  });

  it("never flags an order without a due date", () => {
    expect(isOrderOverdue("", "cutting")).toBe(false);
  });
});

describe("matchesOrderSearch", () => {
  const order = { id: "B2401", customer: "Priya Sharma", phone: "+91 98765-43210" };

  it("matches everything on an empty or whitespace query", () => {
    expect(matchesOrderSearch(order, "")).toBe(true);
    expect(matchesOrderSearch(order, "   ")).toBe(true);
  });

  it("matches on customer name, case-insensitively", () => {
    expect(matchesOrderSearch(order, "priya")).toBe(true);
    expect(matchesOrderSearch(order, "SHARMA")).toBe(true);
    expect(matchesOrderSearch(order, "anita")).toBe(false);
  });

  it("matches on the order id", () => {
    expect(matchesOrderSearch(order, "b2401")).toBe(true);
  });

  it("matches on phone digits, ignoring formatting", () => {
    expect(matchesOrderSearch(order, "98765 432")).toBe(true);
    expect(matchesOrderSearch(order, "12345")).toBe(false);
  });

  it("does not phone-match a query with no digits", () => {
    expect(matchesOrderSearch(order, "xyz")).toBe(false);
  });
});

describe("cn", () => {
  it("merges class names and dedupes tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("filters falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });
});

describe("formatCurrency", () => {
  it("formats a number as an Indian Rupee string", () => {
    expect(formatCurrency(4200)).toBe("₹4,200");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("₹0");
  });
});

describe("formatDate", () => {
  it("returns an em dash for empty input", () => {
    expect(formatDate("")).toBe("—");
  });

  it("formats an ISO date string", () => {
    expect(formatDate("2026-07-10")).toBe("10 Jul 2026");
  });
});

describe("oneDayBefore", () => {
  it("returns an empty string for empty input", () => {
    expect(oneDayBefore("")).toBe("");
  });

  it("returns the previous calendar day", () => {
    expect(oneDayBefore("2026-07-10")).toBe("2026-07-09");
  });

  it("rolls back across a month boundary", () => {
    expect(oneDayBefore("2026-08-01")).toBe("2026-07-31");
  });

  it("rolls back across a year boundary", () => {
    expect(oneDayBefore("2026-01-01")).toBe("2025-12-31");
  });
});

describe("isValidIndianMobile", () => {
  it("accepts a bare 10-digit number starting with 6-9", () => {
    expect(isValidIndianMobile("9876543210")).toBe(true);
    expect(isValidIndianMobile("6000000000")).toBe(true);
  });

  it("accepts +91, 91, and 0 prefixes", () => {
    expect(isValidIndianMobile("+919876543210")).toBe(true);
    expect(isValidIndianMobile("919876543210")).toBe(true);
    expect(isValidIndianMobile("09876543210")).toBe(true);
  });

  it("accepts spaces and dashes as formatting noise", () => {
    expect(isValidIndianMobile("+91 98765-43210")).toBe(true);
  });

  it("rejects numbers not starting with 6-9", () => {
    expect(isValidIndianMobile("5876543210")).toBe(false);
    expect(isValidIndianMobile("1234567890")).toBe(false);
  });

  it("rejects the wrong number of digits", () => {
    expect(isValidIndianMobile("987654321")).toBe(false);
    expect(isValidIndianMobile("98765432100")).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(isValidIndianMobile("abcdefghij")).toBe(false);
    expect(isValidIndianMobile("")).toBe(false);
  });
});

describe("toIndianMobileDigits", () => {
  it("strips a +91 prefix", () => {
    expect(toIndianMobileDigits("+919876543210")).toBe("9876543210");
  });

  it("strips a bare 91 prefix", () => {
    expect(toIndianMobileDigits("919876543210")).toBe("9876543210");
  });

  it("strips a leading 0", () => {
    expect(toIndianMobileDigits("09876543210")).toBe("9876543210");
  });

  it("leaves a bare 10-digit number unchanged", () => {
    expect(toIndianMobileDigits("9876543210")).toBe("9876543210");
  });

  it("returns the cleaned input unchanged when it doesn't match the expected shape", () => {
    expect(toIndianMobileDigits("12345")).toBe("12345");
  });
});

describe("buildOrderWhatsAppMessage", () => {
  it("includes the order id, dress, totals and due date", () => {
    const message = buildOrderWhatsAppMessage({
      orderId: "SDS-101",
      customer: "Priya Sharma",
      dress: "Blouse",
      total: 4200,
      advance: 1000,
      due: "2026-07-10",
      trackingUrl: "https://sara-designer-studio.vercel.app/track/abc-123",
    });
    expect(message).toContain("Priya Sharma");
    expect(message).toContain("SDS-101");
    expect(message).toContain("Blouse");
    expect(message).toContain("Total: ₹4,200");
    expect(message).toContain("Advance paid: ₹1,000");
    expect(message).toContain("Balance due: ₹3,200");
    expect(message).toContain("Due Date: 10 Jul 2026");
    expect(message).toContain(
      "Reminder: Kindly call us on 9 Jul 2026 to confirm pickup — we can only hand over the order on time after your confirmation call."
    );
  });

  it("rolls the reminder date back across a month boundary", () => {
    const message = buildOrderWhatsAppMessage({
      orderId: "SDS-101",
      customer: "Priya",
      dress: "Blouse",
      total: 1000,
      advance: 1000,
      due: "2026-08-01",
      trackingUrl: "https://sara-designer-studio.vercel.app/track/abc-123",
    });
    expect(message).toContain(
      "Reminder: Kindly call us on 31 Jul 2026 to confirm pickup — we can only hand over the order on time after your confirmation call."
    );
  });

  it("floors the balance at zero when the order is fully paid", () => {
    const message = buildOrderWhatsAppMessage({
      orderId: "SDS-101",
      customer: "Priya",
      dress: "Blouse",
      total: 1000,
      advance: 1000,
      due: "2026-07-10",
      trackingUrl: "https://sara-designer-studio.vercel.app/track/abc-123",
    });
    expect(message).toContain("Balance due: ₹0");
  });

  it("includes the tracking link", () => {
    const message = buildOrderWhatsAppMessage({
      orderId: "SDS-101",
      customer: "Priya",
      dress: "Blouse",
      total: 1000,
      advance: 1000,
      due: "2026-07-10",
      trackingUrl: "https://sara-designer-studio.vercel.app/track/abc-123",
    });
    expect(message).toContain("Track your order here: https://sara-designer-studio.vercel.app/track/abc-123");
  });

  it("includes the numbered order-form policy notes", () => {
    const message = buildOrderWhatsAppMessage({
      orderId: "SDS-101",
      customer: "Priya",
      dress: "Blouse",
      total: 1000,
      advance: 1000,
      due: "2026-07-10",
      trackingUrl: "https://sara-designer-studio.vercel.app/track/abc-123",
    });
    expect(message).toContain("Note:");
    ORDER_TERMS.forEach((term, i) => {
      expect(message).toContain(`${i + 1}. ${term}`);
    });
  });

  it("includes the polite no-modification policy note", () => {
    expect(ORDER_TERMS).toContain(
      "We kindly request your understanding that once an order has been placed, modifications to it will not be possible."
    );
  });
});

describe("orderBalance", () => {
  const money = { amount: 5000, advance: 1000, finalPayment: 0 };

  it("subtracts the advance before delivery", () => {
    expect(orderBalance(money)).toBe(4000);
  });

  // The bug the delivery payment exists to fix: before finalPayment, a
  // delivered order's balance never moved and it showed as owing forever.
  it("reaches zero once the balance is collected at delivery", () => {
    expect(orderBalance({ ...money, finalPayment: 4000 })).toBe(0);
  });

  it("counts a partial delivery payment", () => {
    expect(orderBalance({ ...money, finalPayment: 1500 })).toBe(2500);
  });

  it("never returns a negative balance for an overpayment", () => {
    expect(orderBalance({ ...money, finalPayment: 9000 })).toBe(0);
    expect(orderBalance({ amount: 100, advance: 500, finalPayment: 0 })).toBe(0);
  });
});

describe("PAYMENT_METHOD_LABELS", () => {
  it("labels the two methods the shop takes", () => {
    expect(PAYMENT_METHOD_LABELS).toEqual({ cash: "Cash", upi: "UPI" });
  });
});

describe("buildOrderStatusWhatsAppMessage", () => {
  const base = {
    orderId: "B2505",
    customer: "Dharshini",
    dress: "Blouse",
    balance: 4000,
    due: "2026-09-04",
    trackingUrl: "https://sara.example/track/tok-1",
  } as const;

  it("reads as a progress update with status, date, balance and the link", () => {
    const message = buildOrderStatusWhatsAppMessage({ ...base, status: "stitching" });

    expect(message).toContain("Hi Dharshini, here's an update on your order B2505 (Blouse)");
    expect(message).toContain("Status: Stitching in progress");
    expect(message).toContain("Delivery date: 4 Sept 2026");
    expect(message).toContain("Balance due: ₹4,000");
    expect(message).toContain("https://sara.example/track/tok-1");
  });

  it("leads with the pickup news when the order is ready", () => {
    const message = buildOrderStatusWhatsAppMessage({ ...base, status: "ready" });
    expect(message).toContain("good news — your order B2505 (Blouse) is ready for pickup");
    expect(message).toContain("Status: Ready for pickup");
  });

  it("says fully paid instead of a balance when nothing is owed", () => {
    const message = buildOrderStatusWhatsAppMessage({ ...base, balance: 0, status: "ready" });
    expect(message).toContain("Fully paid");
    expect(message).not.toContain("Balance due");
  });

  it("treats an overpayment as fully paid rather than a negative balance", () => {
    const message = buildOrderStatusWhatsAppMessage({ ...base, balance: 0, status: "ready" });
    expect(message).toContain("Fully paid");
    expect(message).not.toMatch(/₹-|-₹/); // never a negative balance
  });

  // It is sent repeatedly, unlike the placement receipt — the terms would
  // make it unreadable on a phone.
  it("stays short: no order terms, unlike the placement message", () => {
    const message = buildOrderStatusWhatsAppMessage({ ...base, status: "cutting" });
    expect(message).not.toContain("No bargaining");
    expect(message.split("\n").length).toBeLessThan(12);
  });

  it("uses customer wording for every status, never the workshop shorthand", () => {
    expect(CUSTOMER_STATUS_LABELS.cutting_done).toBe("Cutting completed");
    expect(CUSTOMER_STATUS_LABELS.hemming_hook).toBe("Hemming & hooks in progress");
    expect(Object.values(CUSTOMER_STATUS_LABELS)).not.toContain("Cutting Done");
  });
});

describe("buildWhatsAppShareUrl", () => {
  it("builds a wa.me link with the country code and encoded message", () => {
    const url = buildWhatsAppShareUrl("9876543210", "Hello there");
    expect(url).toBe("https://wa.me/919876543210?text=Hello%20there");
  });

  it("normalizes a phone number that already has a +91 prefix", () => {
    const url = buildWhatsAppShareUrl("+919876543210", "Hi");
    expect(url).toBe("https://wa.me/919876543210?text=Hi");
  });
});
