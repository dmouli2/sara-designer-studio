// The extraction prompt and response schema for reading a photographed
// order-book spread. The field lists mirror the printed slips exactly (and
// therefore the app's measurement keys — see src/types). Accuracy posture:
// the model must transcribe, never guess — an empty value with confidence
// "low" is always preferable to a wrong value, because every draft is
// verified by the admin against the photo before it can become an order.

export const SLIP_EXTRACTION_PROMPT = `You are transcribing ONE handwritten tailoring order slip from the order books of "Sara Designer Studio" (Dharapuram, Tamil Nadu, India). The photo shows a book spread: the MEASUREMENT SLIP on the left and the BILL COUNTERFOIL on the right.

IMPORTANT — WHAT TO READ:
- The photo may be ROTATED (page sideways) — orient yourself by the printed headers first.
- Read only the main slip that fills most of the frame (white original or a yellow carbon copy). Other pages visible at the edges or underneath — IGNORE those completely.
- Printed text is the form itself. Extract only the HANDWRITTEN (pen) entries.
- Handwriting is Indian-style pen writing; digits may look joined. 1/7, 4/9, 3/8 confusions are common — look carefully, digit by digit.
- The printed header shows the SHOP's own phone ("Cell: 94881 26126") — that is NEVER the customer's phone. The customer's phone is only what is handwritten after "Phone :" on the bill side. If nothing is handwritten there, phone is "".

DO NOT GUESS — this is the most important rule:
- Many boxes are simply blank. An empty value is always correct for a blank box; a guessed value is never acceptable.
- If you catch yourself outputting the same number for many different measurement boxes, stop — that pattern means you are guessing, not reading. Re-check each box; leave unreadable ones empty with confidence "low".
- Mark confidence "low" whenever ink is faint/smudged, digits overlap other writing, or you had to choose between two plausible readings. It is normal for a messy slip to have many "low" fields.

STEP 0 — VALIDATE THE IMAGE first:
- If the photo does NOT show a Sara Designer Studio order-book slip at all (random object, screenshot, unrelated document, blank page), set imageProblem to "not_a_slip", set bookType "unknown", leave every other field empty, and stop.
- If it IS an order slip but so blurry, dark, or cropped that the handwriting is mostly unreadable, set imageProblem to "unreadable", still extract whatever few fields you genuinely can, and mark them "low".
- Otherwise set imageProblem to "ok".

STEP 1 — DETECT THE BOOK TYPE from the printed header of the slip:
- "BLOUSE ORDER FORM" → bookType "Blouse"
- "SALWAR ORDER FORM" → bookType "Salwar"
- If you cannot see the header clearly, use "unknown" with confidence "low".

STEP 2 — EXTRACT, using the matching field list below. For every measurement box output an object { key, value, note, confidence }:
- "value" must contain ONLY the measurement number (digits, optionally decimals like 14.5 or simple fractions like 13 1/2). If the box is blank, use "".
- ANY other pen writing in or next to the box (words, arrows, symbols, Tamil text) goes into "note" verbatim — never into "value".
- Omit boxes that are completely blank (no value, no note).

UB vs BUST — these two rows are adjacent and are the pair most often mixed up, because the pen strokes sit low and straddle the rule between them:
- UB (Under Bust) is printed DIRECTLY ABOVE Bust (on the salwar slip the lower row is labelled just "B").
- UB is measured under the bust, so its number is ALWAYS SMALLER than Bust — 40 / 42.5, never 42.5 / 40.
- After reading both, check that ub < bust. If it isn't, you have attached the numbers to the wrong rows: swap them back onto the correct rows, and mark both "low". Only leave ub > bust if the slip genuinely, unmistakably says so.

BLOUSE measurement keys (printed label → key), in printed order:
Length→length, Shoulder→shoulder, HS→hs, S.Length→sl, MLOS→mlos, TLOS→tlos, AHS→ahs, UB→ub, Bust→bust, Waist→waist, FN/NR→fnNr, BN→bn, Dart→dart, DBD→dbd, P→p, Saree Fall→sareeFall, Piko→piko

SALWAR measurement keys, in printed order:
Top section: Length→top.length, Shoulder→top.shoulder, HS→top.hs, S.L→top.sl, TLOS→top.tlcs, AH→top.ah, UB→top.ub, B→top.bust, Waist→top.waist, Hip→top.hip, FN/NR→top.fnNr, BN→top.bn
PANT section: Height→pant.height, Hip→pant.hip, Waist→pant.waist, TL→pant.tl, KL→pant.kl, Full Length→pant.fullLength, YOKE→pant.yoke
SHAWL box→shawl
(The pant section prints TL twice; if both are filled, put the first in pant.tl's value and mention the second in its note.)

THE MEASUREMENT GARMENT ("alavu blouse") — why a slip can legitimately have NO measurements:
- Customers often hand over a blouse or salwar of their own for the shop to copy, instead of being measured. When they do, the measurement boxes are left blank on purpose and the shop writes a note somewhere on the slip.
- Set sampleGarment true ONLY if you can actually see such a note — Tamil "அளவு" / "அளவு பிளவுஸ்", or written in English as "alavu", "alavu blouse", "measurement blouse", "sample blouse", "sample", "M.B", "model blouse", "as per blouse", or the measurement block struck through with such a note beside it.
- Blank measurement boxes ALONE are NOT enough: a slip can be blank because the pen writing is faint or the page is cropped. No note visible → sampleGarment false.
- This is not a reason to stop reading: still extract the name, phone, items, amounts and dates exactly as usual.

FROM THE BILL COUNTERFOIL (right side):
- customerName: the handwritten Name. It usually also appears on the measurement slip's Name line — read BOTH and compare; if they disagree or either is unclear, mark confidence "low". Tamil names are often long compounds (e.g. Priyadharshini, Dharshini, Lavanya) — transcribe every letter, do not shorten.
- phone: the handwritten Phone digits only (see the shop-phone warning above).
- lineItems: each row of the items table that has ANY handwriting: { particulars (the printed row label, or the handwritten text for blank/extra rows), qty (number, 0 if blank), amount (number, 0 if blank), note (other pen writing on that row), confidence }. A row may hold two amounts (e.g. "1300 + 1350" for qty 2) — put the sum split as qty × per-piece only if identical, otherwise keep qty and put the breakdown in note.
- THE ADVANCE BOX — read this rule twice, it is the field most often invented:
  * Most slips have NO advance written. A blank Advance box is the normal case, not a failure.
  * Look at the box printed "Advance" and ONLY at that box. Set advanceBoxFilled true only if you can see actual pen strokes forming a number inside or immediately beside it.
  * If advanceBoxFilled is false, advance MUST be "".
  * NEVER derive the advance from anything else. Do not copy the Total, the Balance, the "Given" box, an amount from the items table, or a number written elsewhere on the page into advance. If the only number you can find is somewhere else on the slip, the Advance box is blank — say so.
  * A carbon-copy shadow or an impression from the previous page is not handwriting on this slip.
- writtenTotal: the Total, digits only ("" if blank).
- AMOUNT SANITY CHECK: stitching amounts are usually 3–4 digits (₹100–₹5000) and often start with 1 written close to the column line — check the left edge of every amount for a leading digit you may have missed. Then verify: does the sum of the amounts equal the written Total? If not, re-read every amount AND the Total once more; whatever still disagrees, mark confidence "low".
- billNo: the printed or stamped B.No / Bill No. date: the written Date box only. dueDate: the written "Due Date" box ONLY — it is often blank; if blank return "". NEVER copy the Date into dueDate. The "Reminder Date" is shop bookkeeping — never copy it into dueDate (or anywhere else).

EVERYTHING ELSE — extraNotes is ONLY for genuine style or instruction writing: words in the big sketch area, sleeve/neck/cut instructions (e.g. "princess cut blouse", "back hook", "3/4 sleeve"), margin notes about the garment. Ticks or checkmarks in the printed boxes (Given, L.B, O.B, O.Shalwar, L.Shalwar, M.TOP, M.PANT, SHAWL) and the Reminder Date are shop bookkeeping, NOT style instructions — do NOT put them into extraNotes. Do not lose any style writing.

CONFIDENCE — for every value: "high" only when you are certain; otherwise "low". CRITICAL FIELDS (customerName, phone, every qty/amount, advance, writtenTotal): if you are not sure of even one digit/letter, keep your best reading but mark confidence "low". NEVER invent a value for an empty box.

Return exactly the JSON described by the response schema.`;

// Gemini structured-output schema (a subset of OpenAPI). Measurements ride
// as an array of {key, value, note, confidence} because the keys are
// dynamic per book type.
const CONFIDENCE = { type: "STRING", enum: ["high", "low"] };

export const SLIP_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    bookType: { type: "STRING", enum: ["Blouse", "Salwar", "unknown"] },
    bookTypeConfidence: CONFIDENCE,
    billNo: { type: "STRING" },
    date: { type: "STRING" },
    dueDate: { type: "STRING" },
    customerName: { type: "STRING" },
    customerNameConfidence: CONFIDENCE,
    phone: { type: "STRING" },
    phoneConfidence: CONFIDENCE,
    measurements: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          key: { type: "STRING" },
          value: { type: "STRING" },
          note: { type: "STRING" },
          confidence: CONFIDENCE,
        },
        required: ["key", "value", "confidence"],
      },
    },
    lineItems: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          particulars: { type: "STRING" },
          qty: { type: "NUMBER" },
          amount: { type: "NUMBER" },
          note: { type: "STRING" },
          confidence: CONFIDENCE,
        },
        required: ["particulars", "qty", "amount", "confidence"],
      },
    },
    advance: { type: "STRING" },
    advanceConfidence: CONFIDENCE,
    // Independent of `advance` on purpose: a model that has invented a number
    // still has to assert, separately, that the box was written in at all.
    // normalizeExtraction refuses to prefill the advance unless this is true.
    advanceBoxFilled: { type: "BOOLEAN" },
    // True only when the slip carries an explicit "alavu blouse"/"measurement
    // blouse" note — blank measurement boxes on their own never set it. See
    // normalizeExtraction, which warns about a measurement-less slip either
    // way, so a missed note costs a tick rather than a wrong order.
    sampleGarment: { type: "BOOLEAN" },
    writtenTotal: { type: "STRING" },
    writtenTotalConfidence: CONFIDENCE,
    extraNotes: { type: "ARRAY", items: { type: "STRING" } },
    // Gemini rejects "" as an enum value, so "ok" is the all-clear sentinel;
    // coerceExtraction drops it, leaving imageProblem absent on good scans.
    imageProblem: { type: "STRING", enum: ["ok", "not_a_slip", "unreadable"] },
  },
  required: [
    "bookType",
    "bookTypeConfidence",
    "billNo",
    "date",
    "dueDate",
    "customerName",
    "customerNameConfidence",
    "phone",
    "phoneConfidence",
    "measurements",
    "lineItems",
    "advance",
    "advanceConfidence",
    "advanceBoxFilled",
    "sampleGarment",
    "writtenTotal",
    "writtenTotalConfidence",
    "extraNotes",
    "imageProblem",
  ],
} as const;
