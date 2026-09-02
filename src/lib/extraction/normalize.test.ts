import { describe, it, expect } from "vitest";
import type { SlipExtraction } from "@/types";
import {
  hasNoMeasurements,
  isBookkeepingNote,
  lineItemsForDress,
  measurementsForDress,
  normalizeExtraction,
  parseBookDate,
  ubBustWarning,
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
    // One readable box, so the shared fixture is an ordinary measured slip —
    // a slip with NO measurements is its own case (a measurement garment, or
    // a photo nothing could be read from) and warns accordingly.
    measurements: [{ key: "length", value: "14", confidence: "high" }],
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

describe("ubBustWarning", () => {
  function blouseWith(ub: string, bust: string) {
    return measurementsForDress(
      extraction({
        measurements: [
          { key: "ub", value: ub, confidence: "high" },
          { key: "bust", value: bust, confidence: "high" },
        ],
      }),
      "Blouse"
    );
  }

  it("flags a blouse whose UB reads larger than its Bust", () => {
    // Exactly the B2502 case: 40 / 42.5 written across the rule between the
    // two rows and read onto the wrong ones.
    const warning = ubBustWarning(blouseWith("42.5", "40"));
    expect(warning).toContain("UB (42.5) is larger than Bust (40)");
  });

  it("says nothing when UB is smaller than Bust", () => {
    expect(ubBustWarning(blouseWith("31", "33"))).toBeNull();
  });

  it("says nothing when they are equal", () => {
    expect(ubBustWarning(blouseWith("34", "34"))).toBeNull();
  });

  it("says nothing when either value is blank or non-numeric", () => {
    expect(ubBustWarning(blouseWith("", "33"))).toBeNull();
    expect(ubBustWarning(blouseWith("42", ""))).toBeNull();
    expect(ubBustWarning(blouseWith("loose", "33"))).toBeNull();
  });

  it("flags the same swap in a salwar top section", () => {
    const meas = measurementsForDress(
      extraction({
        bookType: "Salwar",
        measurements: [
          { key: "top.ub", value: "38", confidence: "high" },
          { key: "top.bust", value: "36", confidence: "high" },
        ],
      }),
      "Salwar"
    );
    expect(ubBustWarning(meas)).toContain("UB (38) is larger than Bust (36)");
  });

  it("says nothing for a null or generic measurement set", () => {
    expect(ubBustWarning(null)).toBeNull();
    expect(
      ubBustWarning({
        type: "generic",
        bust: "40", waist: "", hip: "", length: "", shoulder: "", sleeve: "", neckDepth: "", armRound: "",
      })
    ).toBeNull();
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
    // A read advance always has to be confirmed against the photo — a
    // hallucinated one arrives with high confidence, so confidence alone
    // can't be the gate on money.
    expect(result.warnings).toEqual(["Confirm the Advance ₹200 was actually collected — check it against the photo."]);
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

  it("adds the UB/Bust swap warning to a scan that reads UB larger than Bust", () => {
    const result = normalizeExtraction(
      extraction({
        measurements: [
          { key: "ub", value: "42.5", confidence: "high" },
          { key: "bust", value: "40", confidence: "high" },
        ],
        lineItems: [{ particulars: "Blouse", qty: 1, amount: 400, confidence: "high" }],
      }),
      now
    );
    expect(result.warnings).toContain(
      "UB (42.5) is larger than Bust (40) — these two rows sit next to each other on the slip and are easy to read the wrong way round. Check the photo."
    );
    // Flagged, never silently corrected — the admin has the photo.
    expect(result.prefill.meas).toMatchObject({ ub: "42.5", bust: "40" });
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
    expect(result.warnings).toEqual(["Confirm the Advance ₹200 was actually collected — check it against the photo."]);
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
      "Confirm the Advance ₹200 was actually collected — check it against the photo.",
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
    expect(result.warnings).toEqual([
      "Confirm the Advance ₹500 was actually collected — check it against the photo.",
      "Advance ₹500 is more than the Total ₹400 — check both.",
    ]);
  });

  // The bug this closes: a vision model reads a number from elsewhere on the
  // slip — the Total, the "Given" box — and files it as an advance. That is
  // money the shop never took, and it silently reduces what gets collected
  // at delivery. So the model has to say twice that an advance exists.
  describe("the advance box", () => {
    it("refuses to prefill an advance the model says it didn't see", () => {
      const result = normalizeExtraction(
        extraction({ advance: "500", advanceBoxFilled: false, advanceConfidence: "high" }),
        now
      );
      expect(result.prefill.advance).toBe("");
      expect(result.warnings).toContain(
        "An advance of ₹500 was read, but the Advance box looks blank — left empty. Enter it only if the slip really shows one."
      );
    });

    it("prefills when both signals agree", () => {
      const result = normalizeExtraction(
        extraction({ advance: "500", advanceBoxFilled: true, advanceConfidence: "high" }),
        now
      );
      expect(result.prefill.advance).toBe("500");
    });

    it("says nothing when the box is blank and no number was read", () => {
      const result = normalizeExtraction(
        extraction({ advance: "", advanceBoxFilled: false }),
        now
      );
      expect(result.prefill.advance).toBe("");
      expect(result.warnings.filter((w) => w.includes("Advance"))).toEqual([]);
    });

    // Drafts scanned before the field existed keep behaving as they did.
    it("trusts the value when the signal is absent", () => {
      const result = normalizeExtraction(extraction({ advance: "250" }), now);
      expect(result.prefill.advance).toBe("250");
    });

    it("still reports an unreadable advance as unreadable", () => {
      const result = normalizeExtraction(
        extraction({ advance: "2s0", advanceBoxFilled: true }),
        now
      );
      expect(result.prefill.advance).toBe("");
      expect(result.warnings).toContain("The Advance couldn't be read as a number — verify it.");
    });

    it("asks for a low-confidence advance to be verified", () => {
      const result = normalizeExtraction(
        extraction({ advance: "300", advanceBoxFilled: true, advanceConfidence: "low" }),
        now
      );
      expect(result.warnings).toContain("Verify the Advance ₹300 against the photo.");
    });
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

// ── The measurement garment ("alavu blouse") ─────────────────────────────
// A slip with no measurements is either a customer who left a garment to cut
// to, or a photo nothing could be read from. Those look identical from here,
// so the flag is only ever set by an explicit note the model saw — the empty
// case is raised as a question instead.
describe("measurement garment", () => {
  it("hasNoMeasurements is true only when no box carries a value", () => {
    expect(hasNoMeasurements(extraction({ measurements: [] }))).toBe(true);
    // A box with only a pen remark beside it still has no measurement.
    expect(
      hasNoMeasurements(
        extraction({ measurements: [{ key: "length", value: " ", note: "loose", confidence: "low" }] })
      )
    ).toBe(true);
    expect(
      hasNoMeasurements(extraction({ measurements: [{ key: "length", value: "14", confidence: "high" }] }))
    ).toBe(false);
  });

  it("prefills the flag when the slip is marked, and says so", () => {
    const result = normalizeExtraction(extraction({ sampleGarment: true, measurements: [] }));
    expect(result.prefill.sampleGarment).toBe(true);
    expect(result.warnings).toContain(
      "The slip is marked as a measurement blouse/salwar — no measurements will be recorded. Untick it in step 2 if that's wrong."
    );
    // Only one of the two — the marked slip explains its own empty boxes.
    expect(result.warnings.filter((w) => w.includes("measurement blouse/salwar"))).toHaveLength(1);
  });

  it("asks rather than assumes when the boxes are simply empty", () => {
    const result = normalizeExtraction(extraction({ measurements: [] }));
    expect(result.prefill.sampleGarment).toBe(false);
    expect(result.warnings).toContain(
      "No measurements could be read from the slip. If the customer gave a measurement blouse/salwar, tick that in step 2 — otherwise enter the measurements from the photo."
    );
  });

  it("stays quiet on an ordinary slip that has measurements", () => {
    const result = normalizeExtraction(extraction());
    expect(result.prefill.sampleGarment).toBe(false);
    expect(result.warnings.some((w) => w.includes("measurement blouse/salwar"))).toBe(false);
  });

  // The book type gates the question: an undetected book already tells the
  // admin to verify every field, so a second warning about the blank
  // measurement boxes only adds noise.
  it("skips the empty-measurements question when the book type is unknown", () => {
    const result = normalizeExtraction(extraction({ bookType: "unknown", measurements: [] }));
    expect(result.warnings.some((w) => w.includes("No measurements could be read"))).toBe(false);
  });

  // Drafts scanned before the field existed carry nothing — and absent must
  // never read as true, which would silently drop a real measurement.
  it("treats an absent flag as not marked", () => {
    expect(normalizeExtraction(extraction()).prefill.sampleGarment).toBe(false);
    expect(normalizeExtraction(extraction({ sampleGarment: false })).prefill.sampleGarment).toBe(false);
  });
});
