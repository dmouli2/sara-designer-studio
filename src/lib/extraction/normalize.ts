import type {
  BlouseMeasurements,
  ExtractedField,
  GarmentMeasurements,
  OrderLineItem,
  SalwarMeasurements,
  SlipExtraction,
} from "@/types";
import { emptyBlouse, emptySalwar } from "@/lib/measurements";
import { LINE_ITEM_PRESETS, lineItemCategoryForDress } from "@/lib/mock";
import { isValidIndianMobile, toIndianMobileDigits } from "@/lib/utils";

// Pure translation of a raw SlipExtraction into (a) values the new-order
// wizard can be prefilled with and (b) the warnings the admin must resolve.
// Shared by the drafts server action (warnings at scan time) and the wizard
// (prefill at confirm time) — keep it free of client/server-only imports.

export interface ScanPrefill {
  dress: string | null; // null when the book type couldn't be detected
  name: string;
  phone: string; // bare 10 digits when valid, raw digits otherwise
  meas: GarmentMeasurements | null; // null when dress is null
  notes: string;
  lineItems: OrderLineItem[]; // preset rows with extracted values merged in
  advance: string;
  delivery: string; // ISO yyyy-mm-dd, "" when the due date wasn't readable
}

export interface NormalizedScan {
  prefill: ScanPrefill;
  warnings: string[];
  itemsTotal: number; // Σ qty × amount of the extracted items
  writtenTotal: number | null; // the handwritten Total, when readable
}

// The numbers-only rule: a measurement value may hold digits, decimals and
// simple fractions. Anything else (words, arrows, Tamil text) belongs in
// the field's comment.
const NUMERIC_VALUE = /^[\d\s.,/¼½¾-]*$/;

function splitMeasurementValue(field: ExtractedField): { value: string; note: string } {
  const raw = field.value.trim();
  const note = field.note?.trim() ?? "";
  if (NUMERIC_VALUE.test(raw)) return { value: raw, note };
  // Non-numeric writing landed in the value — move it to the comment.
  return { value: "", note: note ? `${raw} · ${note}` : raw };
}

// "top.fnNr" → "Top Fn Nr" — used in warnings and on the draft review page.
export function labelForKey(key: string): string {
  return key
    .replace(".", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Builds a full GarmentMeasurements for the given dress from the extracted
// entries. Exported separately because the wizard re-runs it when the admin
// manually picks the type for an "unknown" scan.
export function measurementsForDress(extraction: SlipExtraction, dress: string): GarmentMeasurements {
  if (dress === "Salwar") {
    const meas: SalwarMeasurements = emptySalwar();
    const topNotes: Record<string, string> = {};
    const pantNotes: Record<string, string> = {};
    for (const field of extraction.measurements) {
      const { value, note } = splitMeasurementValue(field);
      const [section, key] = field.key.includes(".") ? field.key.split(".") : ["", field.key];
      if (section === "top" && key in meas.top) {
        meas.top[key as keyof SalwarMeasurements["top"]] = value;
        if (note) topNotes[key] = note;
      } else if (section === "pant" && key in meas.pant) {
        meas.pant[key as keyof SalwarMeasurements["pant"]] = value;
        if (note) pantNotes[key] = note;
      } else if (field.key === "shawl") {
        meas.shawl = value || note;
      }
    }
    if (Object.keys(topNotes).length) meas.topNotes = topNotes;
    if (Object.keys(pantNotes).length) meas.pantNotes = pantNotes;
    return meas;
  }

  const meas: BlouseMeasurements = emptyBlouse();
  const fieldNotes: Record<string, string> = {};
  for (const field of extraction.measurements) {
    const { value, note } = splitMeasurementValue(field);
    if (field.key !== "type" && field.key !== "fieldNotes" && field.key in meas) {
      (meas as unknown as Record<string, string>)[field.key] = value;
      if (note) fieldNotes[field.key] = note;
    }
  }
  if (Object.keys(fieldNotes).length) {
    meas.fieldNotes = fieldNotes as BlouseMeasurements["fieldNotes"];
  }
  return meas;
}

// UB and Bust are adjacent rows on both books, and handwriting that straddles
// the rule between them is the single most common way the model attaches the
// numbers to the wrong rows. UB is measured under the bust, so it is always
// the smaller number — ub > bust means they are almost certainly swapped.
// Flagged rather than auto-corrected: the admin has the photo in front of
// them, and a rare genuine reading must not be silently rewritten.
export function ubBustWarning(meas: GarmentMeasurements | null): string | null {
  const pair =
    meas?.type === "blouse"
      ? { ub: meas.ub, bust: meas.bust }
      : meas?.type === "salwar"
        ? { ub: meas.top.ub, bust: meas.top.bust }
        : null;
  if (!pair) return null;
  const ub = parseFloat(pair.ub);
  const bust = parseFloat(pair.bust);
  if (!Number.isFinite(ub) || !Number.isFinite(bust) || ub <= bust) return null;
  return `UB (${pair.ub}) is larger than Bust (${pair.bust}) — these two rows sit next to each other on the slip and are easy to read the wrong way round. Check the photo.`;
}

// Fuzzy match of a handwritten/printed particulars label against the app's
// preset row names — tolerates case, punctuation and one-or-two-letter
// spelling drift ("Sareefalls Piko" vs "Sareesfalls Piko").
function canon(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

// Exact canonical equality first; only unmatched names fall back to fuzzy.
// (A single pass with substring matching would wrongly slot "Lining Blouse"
// into the "Blouse" preset because "Blouse" is scanned first.)
function fuzzyMatchesPreset(preset: string, particulars: string): boolean {
  const p = canon(preset);
  const q = canon(particulars);
  if (!p || !q) return false;
  // Substring only counts when the lengths are close — otherwise a longer
  // handwritten row like "hand embroidery neck" would swallow the
  // "Embroidery" preset instead of being kept as its own row.
  const closeLength = Math.abs(p.length - q.length) <= 3;
  return (closeLength && (p.includes(q) || q.includes(p))) || editDistance(p, q) <= 2;
}

// Merges extracted items into the preset row list (same order the wizard
// shows). Unrecognised handwritten rows are appended verbatim so nothing
// from the book is dropped.
export function lineItemsForDress(
  extraction: SlipExtraction,
  dress: string
): { lineItems: OrderLineItem[]; warnings: string[] } {
  const warnings: string[] = [];
  const presets = LINE_ITEM_PRESETS[lineItemCategoryForDress(dress)];
  const items: OrderLineItem[] = presets.map((p) => ({ particulars: p, qty: 0, amount: 0 }));
  const matched = new Set<number>();

  // Pair each extracted row with a preset row: exact canonical matches win
  // first, then fuzzy matches claim what's left.
  const presetFor = new Map<number, number>(); // extracted index → preset index
  extraction.lineItems.forEach((li, i) => {
    const idx = presets.findIndex((p, pi) => !matched.has(pi) && canon(p) === canon(li.particulars));
    if (idx >= 0) {
      matched.add(idx);
      presetFor.set(i, idx);
    }
  });
  extraction.lineItems.forEach((li, i) => {
    if (presetFor.has(i)) return;
    const idx = presets.findIndex((p, pi) => !matched.has(pi) && fuzzyMatchesPreset(p, li.particulars));
    if (idx >= 0) {
      matched.add(idx);
      presetFor.set(i, idx);
    }
  });

  for (const [i, li] of extraction.lineItems.entries()) {
    // The book often leaves Qty blank when it's one piece — an amount with
    // no quantity means qty 1, flagged for the admin to double-check.
    let qty = li.qty;
    if (qty === 0 && li.amount > 0) {
      qty = 1;
      warnings.push(`${li.particulars}: quantity was blank — assumed 1, please verify.`);
    }
    if (li.confidence === "low" && (li.amount > 0 || li.qty > 0 || li.note)) {
      warnings.push(`Verify item "${li.particulars}" against the photo.`);
    }

    const idx = presetFor.get(i) ?? -1;
    const entry: OrderLineItem = {
      particulars: idx >= 0 ? presets[idx] : li.particulars,
      qty,
      amount: li.amount,
      ...(li.note?.trim() ? { note: li.note.trim() } : {}),
    };
    if (idx >= 0) {
      items[idx] = entry;
    } else if (li.amount > 0 || qty > 0 || li.note) {
      items.push(entry);
    }
  }
  return { lineItems: items, warnings };
}

// Book dates are written as d/m, d-m, d.m, optionally with a 2- or 4-digit
// year. Without a year: due dates are near-future, so a date that would be
// more than 60 days in the past rolls into next year.
export function parseBookDate(raw: string, now: Date = new Date()): string {
  const m = raw.trim().match(/^(\d{1,2})[\s./-](\d{1,2})(?:[\s./-](\d{2,4}))?$/);
  if (!m) return "";
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return "";

  let year: number;
  if (m[3]) {
    year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
  } else {
    year = now.getFullYear();
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getTime() < now.getTime() - 60 * 24 * 60 * 60 * 1000) year += 1;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject overflows like 31/2 silently becoming 2/3.
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return "";
  return date.toISOString().slice(0, 10);
}

// Tick-box labels printed on the slip — pen marks against these are shop
// bookkeeping (what fabric was handed over, which boxes apply, reminder
// dates), never style instructions the tailor needs. Compared with all
// punctuation/whitespace stripped, so "L.B", "LB:" and "l b" all match.
const BOOKKEEPING_LABELS = [
  "given",
  "oblouse",
  "lblouse",
  "oshalwar",
  "lshalwar",
  "lb",
  "ob",
  "mtop",
  "mpant",
  "shawl",
  "reminderdate",
  "billno",
  "date",
];

// True for extraNotes entries that are bookkeeping marks rather than real
// style writing. An entry is dropped when, ignoring case/punctuation/spaces,
// it starts with a bookkeeping label followed by nothing or by non-letter
// content ("L.B: ✓", "Reminder Date: 14/6", "Given: 1 Buy") — but a label
// word leading into more prose ("shawl with tassels") is kept as style text.
export function isBookkeepingNote(note: string): boolean {
  const compact = note.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!compact) return true; // only ticks/symbols — nothing to keep
  return BOOKKEEPING_LABELS.some((label) => {
    if (!compact.startsWith(label)) return false;
    const rest = compact.slice(label.length);
    return rest === "" || !/^[a-z]/.test(rest);
  });
}

export function normalizeExtraction(extraction: SlipExtraction, now: Date = new Date()): NormalizedScan {
  const warnings: string[] = [];

  const dress = extraction.bookType === "unknown" ? null : extraction.bookType;
  if (!dress) {
    warnings.push("Couldn't detect Blouse vs Salwar from the slip — pick the order type and verify every field.");
  } else if (extraction.bookTypeConfidence === "low") {
    warnings.push(`Book type read as ${dress} with low confidence — confirm it.`);
  }

  const name = extraction.customerName.trim();
  if (!name) warnings.push("Customer name couldn't be read — enter it from the photo.");
  else if (extraction.customerNameConfidence === "low") {
    warnings.push(`Verify customer name "${name}" against the photo.`);
  }

  const phone = toIndianMobileDigits(extraction.phone);
  if (!isValidIndianMobile(phone)) {
    warnings.push("Phone number is missing or invalid — enter it from the photo.");
  } else if (extraction.phoneConfidence === "low") {
    warnings.push(`Verify phone number ${phone} against the photo.`);
  }

  const meas = dress ? measurementsForDress(extraction, dress) : null;
  const ubBust = ubBustWarning(meas);
  if (ubBust) warnings.push(ubBust);

  const lowMeasurements = extraction.measurements
    .filter((f) => f.confidence === "low" && (f.value || f.note))
    .map((f) => labelForKey(f.key));
  if (lowMeasurements.length) {
    warnings.push(`Verify measurements: ${lowMeasurements.join(", ")}.`);
  }

  const { lineItems, warnings: itemWarnings } =
    dress ? lineItemsForDress(extraction, dress) : { lineItems: [], warnings: [] };
  warnings.push(...itemWarnings);

  const itemsTotal = lineItems.reduce((s, li) => s + li.qty * li.amount, 0);
  const writtenTotal = /^\d+$/.test(extraction.writtenTotal.trim())
    ? parseInt(extraction.writtenTotal.trim(), 10)
    : null;
  if (extraction.writtenTotal && writtenTotal === null) {
    warnings.push("The written Total couldn't be read as a number — verify amounts.");
  }
  if (extraction.writtenTotalConfidence === "low" && extraction.writtenTotal) {
    warnings.push(`Verify the written Total ₹${extraction.writtenTotal} against the photo.`);
  }
  if (writtenTotal !== null && itemsTotal > 0 && writtenTotal !== itemsTotal) {
    warnings.push(
      `Written Total ₹${writtenTotal} doesn't match the items total ₹${itemsTotal} — fix the items or the total before placing the order.`
    );
  }

  const advance = /^\d+$/.test(extraction.advance.trim()) ? extraction.advance.trim() : "";
  if (extraction.advance && !advance) {
    warnings.push("The Advance couldn't be read as a number — verify it.");
  } else if (advance && extraction.advanceConfidence === "low") {
    warnings.push(`Verify the Advance ₹${advance} against the photo.`);
  }
  if (advance && writtenTotal !== null && parseInt(advance, 10) > writtenTotal) {
    warnings.push(`Advance ₹${advance} is more than the Total ₹${writtenTotal} — check both.`);
  }

  const delivery = parseBookDate(extraction.dueDate, now);
  if (extraction.dueDate && !delivery) {
    warnings.push(`Due date "${extraction.dueDate}" couldn't be read — set the delivery date manually.`);
  }

  // Only genuine style writing survives into the order notes — tick-box
  // bookkeeping ("L.B: ✓", "Given: 1 Buy", Reminder Date, …) is noise the
  // tailor never needs, and no scan header rides along either.
  const notes = extraction.extraNotes.filter((n) => !isBookkeepingNote(n)).join("\n");

  return {
    prefill: {
      dress,
      name,
      phone,
      meas,
      notes,
      lineItems,
      advance,
      delivery,
    },
    warnings,
    itemsTotal,
    writtenTotal,
  };
}
