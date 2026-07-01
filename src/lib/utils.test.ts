import { describe, it, expect } from "vitest";
import {
  cn,
  formatCurrency,
  formatDate,
  isValidIndianMobile,
  toIndianMobileDigits,
  buildOrderWhatsAppMessage,
  buildWhatsAppShareUrl,
  ORDER_TERMS,
} from "./utils";

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
  it("includes the order id, dress, totals and delivery date", () => {
    const message = buildOrderWhatsAppMessage({
      orderId: "SDS-101",
      customer: "Priya Sharma",
      dress: "Blouse",
      total: 4200,
      advance: 1000,
      due: "2026-07-10",
    });
    expect(message).toContain("Priya Sharma");
    expect(message).toContain("SDS-101");
    expect(message).toContain("Blouse");
    expect(message).toContain("Total: ₹4,200");
    expect(message).toContain("Advance paid: ₹1,000");
    expect(message).toContain("Balance due: ₹3,200");
    expect(message).toContain("Delivery date: 10 Jul 2026");
  });

  it("floors the balance at zero when the order is fully paid", () => {
    const message = buildOrderWhatsAppMessage({
      orderId: "SDS-101",
      customer: "Priya",
      dress: "Blouse",
      total: 1000,
      advance: 1000,
      due: "2026-07-10",
    });
    expect(message).toContain("Balance due: ₹0");
  });

  it("includes the numbered order-form policy notes", () => {
    const message = buildOrderWhatsAppMessage({
      orderId: "SDS-101",
      customer: "Priya",
      dress: "Blouse",
      total: 1000,
      advance: 1000,
      due: "2026-07-10",
    });
    expect(message).toContain("Note:");
    ORDER_TERMS.forEach((term, i) => {
      expect(message).toContain(`${i + 1}. ${term}`);
    });
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
