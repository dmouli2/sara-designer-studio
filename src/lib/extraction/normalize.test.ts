import { describe, it, expect } from "vitest";
import type { SlipExtraction } from "@/types";
import {
  isBookkeepingNote,
  lineItemsForDress,
  measurementsForDress,
  normalizeExtraction,
  parseBookDate,
} from "./normalize";

function extraction(overrides: Partial<SlipExtraction> = {}): SlipExtraction {
  return {
    bookType: "Blouse",
    bookTypeConfidence: "high",
    billNo: "2392",
    date: "25/6",
    dueDate: "30/6/2026",
    customerName: "Vaishnavi",
    customerNameConfidence: "high",
    phone: "9876543210",
    phoneConfidence: "high",
    measurements: [],
    lineItems: [],
    advance: "200",
    advanceConfidence: "high",
    writtenTotal: "400",
    writtenTotalConfidence: "high",
    extraNotes: [],
    ...overrides,
  };
}

describe("measurementsForDress", () => {
  it("maps blouse keys into a full BlouseMeasurements", () => {
    const meas = measurementsForDress(
      extraction({
        measurements: [
          { key: "length", value: "14", confidence: "high" },
          { key: "sareeFall", value: "42", confidence: "high" },
          { key: "unknownKey", value: "9", confidence: "high" },
        ],
      }),
      "Blouse"
    );
    expect(meas.type).toBe("blouse");
    if (meas.type !== "blouse") throw new Error("unreachable");
    expect(meas.length).toBe("14");
    expect(meas.sareeFall).toBe("42");
    expect(meas.shoulder).toBe(""); // untouched fields stay blank
    expect(meas.fieldNotes).toBeUndefined();
  });

  it("moves non-numeric writing into fieldNotes (numbers-only rule)", () => {
    const meas = measurementsForDress(
      extraction({
        measurements: [
          { key: "bust", value: "36 loose", confidence: "high" },
          { key: "hs", value: "7", note: "with cup", confidence: "high" },
        ],
      }),
      "Blouse"
    );
    if (meas.type !== "blouse") throw new Error("unreachable");
    expect(meas.bust).toBe("");
    expect(meas.hs).toBe("7");
    expect(meas.fieldNotes).toEqual({ bust: "36 loose", hs: "with cup" });
  });

  it("keeps fractions and decimals as values", () => {
    const meas = measurementsForDress(
      extraction({
        measurements: [
          { key: "sl", value: "13 1/2", confidence: "high" },
          { key: "waist", value: "30.5", confidence: "high" },
        ],
      }),
      "Blouse"
    );
    if (meas.type !== "blouse") throw new Error("unreachable");
    expect(meas.sl).toBe("13 1/2");
    expect(meas.waist).toBe("30.5");
  });

  it("maps salwar top/pant/shawl sections with per-section notes", () => {
    const meas = measurementsForDress(
      extraction({
        bookType: "Salwar",
        measurements: [
          { key: "top.length", value: "42", confidence: "high" },
          { key: "top.hip", value: "38", note: "ease 2", confidence: "high" },
          { key: "pant.height", value: "36", confidence: "high" },
          { key: "pant.tl", value: "20", note: "second TL 21", confidence: "high" },
          { key: "shawl", value: "", note: "with piko", confidence: "high" },
          { key: "top.notAField", value: "1", confidence: "high" },
        ],
      }),
      "Salwar"
    );
    expect(meas.type).toBe("salwar");
    if (meas.type !== "salwar") throw new Error("unreachable");
    expect(meas.top.length).toBe("42");
    expect(meas.top.hip).toBe("38");
    expect(meas.pant.height).toBe("36");
    expect(meas.topNotes).toEqual({ hip: "ease 2" });
    expect(meas.pantNotes).toEqual({ tl: "second TL 21" });
    expect(meas.shawl).toBe("with piko");
  });
});

describe("lineItemsForDress", () => {
  it("merges extracted rows into the preset list in preset order", () => {
    const { lineItems, warnings } = lineItemsForDress(
      extraction({
        lineItems: [
          { particulars: "Blouse", qty: 2, amount: 400, confidence: "high" },
          { particulars: "Sareefalls Piko", qty: 1, amount: 50, confidence: "high" },
        ],
      }),
      "Blouse"
    );
    expect(lineItems[0]).toEqual({ particulars: "Blouse", qty: 2, amount: 400 });
    // fuzzy match: book prints "Sareefalls Piko", preset is "Sareesfalls Piko"
    const piko = lineItems.find((li) => li.particulars === "Sareesfalls Piko");
    expect(piko).toEqual({ particulars: "Sareesfalls Piko", qty: 1, amount: 50 });
    expect(warnings).toEqual([]);
  });

  it("assumes qty 1 for an amount with a blank qty, with a warning", () => {
    const { lineItems, warnings } = lineItemsForDress(
      extraction({
        lineItems: [{ particulars: "Lining Blouse", qty: 0, amount: 150, confidence: "high" }],
      }),
      "Blouse"
    );
    const lining = lineItems.find((li) => li.particulars === "Lining Blouse");
    expect(lining).toEqual({ particulars: "Lining Blouse", qty: 1, amount: 150 });
    expect(warnings).toEqual(["Lining Blouse: quantity was blank — assumed 1, please verify."]);
  });

  it("appends unmatched handwritten rows verbatim and keeps notes", () => {
    const { lineItems } = lineItemsForDress(
      extraction({
        lineItems: [
          { particulars: "Hand embroidery neck", qty: 1, amount: 250, note: "gold thread", confidence: "high" },
        ],
      }),
      "Blouse"
    );
    expect(lineItems[lineItems.length - 1]).toEqual({
      particulars: "Hand embroidery neck",
      qty: 1,
      amount: 250,
      note: "gold thread",
    });
  });

  it("flags low-confidence items and skips empty unmatched rows", () => {
    const { lineItems, warnings } = lineItemsForDress(
      extraction({
        bookType: "Salwar",
        lineItems: [
          { particulars: "Salwar", qty: 1, amount: 600, confidence: "low" },
          { particulars: "scribble", qty: 0, amount: 0, confidence: "low" },
        ],
      }),
      "Salwar"
    );
    expect(warnings).toEqual(['Verify item "Salwar" against the photo.']);
    expect(lineItems.some((li) => li.particulars === "scribble")).toBe(false);
    expect(lineItems[0]).toEqual({ particulars: "Salwar", qty: 1, amount: 600 });
  });
});

describe("parseBookDate", () => {
  const now = new Date("2026-07-06T10:00:00.000Z");

  it("parses d/m with the current year", () => {
    expect(parseBookDate("30/7", now)).toBe("2026-07-30");
  });

  it("rolls a long-past d/m into next year", () => {
    expect(parseBookDate("15/1", now)).toBe("2027-01-15");
  });

  it("keeps a recent past date in the current year", () => {
    expect(parseBookDate("25/6", now)).toBe("2026-06-25");
  });

  it("parses 2- and 4-digit years and other separators", () => {
    expect(parseBookDate("30-7-26", now)).toBe("2026-07-30");
    expect(parseBookDate("30.7.2026", now)).toBe("2026-07-30");
  });

  it("rejects nonsense and overflow dates", () => {
    expect(parseBookDate("soon", now)).toBe("");
    expect(parseBookDate("31/2", now)).toBe("");
    expect(parseBookDate("0/5", now)).toBe("");
    expect(parseBookDate("5/13", now)).toBe("");
    expect(parseBookDate("", now)).toBe("");
  });
});

describe("normalizeExtraction", () => {
  const now = new Date("2026-07-06T10:00:00.000Z");

  it("produces a clean prefill with no warnings for a good scan", () => {
    const result = normalizeExtraction(
      extraction({
        measurements: [{ key: "length", value: "14", confidence: "high" }],
        lineItems: [{ particulars: "Blouse", qty: 1, amount: 400, confidence: "high" }],
        extraNotes: ["L.B: ✓"],
      }),
      now
    );
    expect(result.warnings).toEqual([]);
    expect(result.prefill.dress).toBe("Blouse");
    expect(result.prefill.name).toBe("Vaishnavi");
    expect(result.prefill.phone).toBe("9876543210");
    expect(result.prefill.delivery).toBe("2026-06-30");
    expect(result.prefill.advance).toBe("200");
    // No scan header, and the L.B tick is bookkeeping — nothing survives.
    expect(result.prefill.notes).toBe("");
    expect(result.prefill.meas?.type).toBe("blouse");
    expect(result.itemsTotal).toBe(400);
    expect(result.writtenTotal).toBe(400);
  });

  it("flags an unknown book type and returns no measurements", () => {
    const result = normalizeExtraction(extraction({ bookType: "unknown" }), now);
    expect(result.prefill.dress).toBeNull();
    expect(result.prefill.meas).toBeNull();
    expect(result.prefill.lineItems).toEqual([]);
    expect(result.warnings[0]).toContain("Couldn't detect Blouse vs Salwar");
  });

  it("flags low-confidence book type, name, phone, totals and measurements", () => {
    const result = normalizeExtraction(
      extraction({
        bookTypeConfidence: "low",
        customerNameConfidence: "low",
        phoneConfidence: "low",
        writtenTotalConfidence: "low",
        advanceConfidence: "low",
        measurements: [
          { key: "length", value: "14", confidence: "low" },
          { key: "bust", value: "", confidence: "low" }, // empty → not flagged
        ],
      }),
      now
    );
    expect(result.warnings).toEqual([
      "Book type read as Blouse with low confidence — confirm it.",
      'Verify customer name "Vaishnavi" against the photo.',
      "Verify phone number 9876543210 against the photo.",
      "Verify measurements: Length.",
      "Verify the written Total ₹400 against the photo.",
      "Verify the Advance ₹200 against the photo.",
    ]);
  });

  it("flags missing name, invalid phone and unreadable amounts/dates", () => {
    const result = normalizeExtraction(
      extraction({
        customerName: "",
        phone: "12345",
        advance: "2oo",
        writtenTotal: "4o0",
        dueDate: "next week",
      }),
      now
    );
    expect(result.warnings).toContain("Customer name couldn't be read — enter it from the photo.");
    expect(result.warnings).toContain("Phone number is missing or invalid — enter it from the photo.");
    expect(result.warnings).toContain("The written Total couldn't be read as a number — verify amounts.");
    expect(result.warnings).toContain("The Advance couldn't be read as a number — verify it.");
    expect(result.warnings).toContain('Due date "next week" couldn\'t be read — set the delivery date manually.');
    expect(result.prefill.advance).toBe("");
    expect(result.prefill.delivery).toBe("");
  });

  it("normalizes +91-prefixed phones to bare 10 digits", () => {
    const result = normalizeExtraction(extraction({ phone: "+919876543210" }), now);
    expect(result.prefill.phone).toBe("9876543210");
    expect(result.warnings).toEqual([]);
  });

  it("warns when the written total doesn't match the items total", () => {
    const result = normalizeExtraction(
      extraction({
        lineItems: [{ particulars: "Blouse", qty: 1, amount: 350, confidence: "high" }],
        writtenTotal: "400",
      }),
      now
    );
    expect(result.warnings).toEqual([
      "Written Total ₹400 doesn't match the items total ₹350 — fix the items or the total before placing the order.",
    ]);
    expect(result.itemsTotal).toBe(350);
  });

  it("warns when the advance exceeds the total", () => {
    const result = normalizeExtraction(
      extraction({
        advance: "500",
        writtenTotal: "400",
        lineItems: [{ particulars: "Blouse", qty: 1, amount: 400, confidence: "high" }],
      }),
      now
    );
    expect(result.warnings).toEqual(["Advance ₹500 is more than the Total ₹400 — check both."]);
  });

  it("keeps only style writing in notes, joined with newlines", () => {
    const result = normalizeExtraction(
      extraction({
        extraNotes: [
          "L.B: ✓",
          "princess cut blouse",
          "Reminder Date: 14/6",
          "back hook",
          "Given: 1 Buy",
        ],
      }),
      now
    );
    expect(result.prefill.notes).toBe("princess cut blouse\nback hook");
  });
});

describe("isBookkeepingNote", () => {
  it("drops every tick-box / bookkeeping label variant", () => {
    for (const note of [
      "Given: ✓",
      "Given: 1 Buy",
      "L.B: ✓",
      "O.B ✓",
      "LB: ✓",
      "OB ✓",
      "O.Blouse: ✓",
      "L.Blouse: ✓",
      "O.Shalwar: ✓",
      "L.Shalwar: ✓",
      "M.TOP: ✓",
      "M.PANT: ✓",
      "SHAWL: ✓",
      "Reminder Date: 14/6",
      "Bill No 2392",
      "Date: 25/6",
      "✓", // bare tick — nothing readable at all
    ]) {
      expect(isBookkeepingNote(note), note).toBe(true);
    }
  });

  it("keeps genuine style writing, even when it opens with a label word", () => {
    for (const note of [
      "princess cut blouse",
      "back hook",
      "3/4 sleeve",
      "boat neck with piping",
      "shawl with tassels", // prose after the label word → style text
    ]) {
      expect(isBookkeepingNote(note), note).toBe(false);
    }
  });
});
