export type OrderStatus =
  | "new"
  | "cutting"
  | "cutting_done"
  | "stitching"
  | "hemming_hook" // finishing gate after stitching — admin marks it done to release to "ready"
  | "ready"
  | "delivered"
  | "cancelled";

// Max reference photos a single order may carry — enforced in
// ReferenceImageUpload (client) and storeReferenceImages (server action).
export const MAX_REFERENCE_IMAGES = 8;

// Max material (fabric) photos a single order may carry — enforced in
// MaterialImageUpload (client) and storeMaterialImages (server action). The
// first photo captured is always the "main" one shown in list views.
export const MAX_MATERIAL_IMAGES = 8;

export type Role = "admin" | "master" | "tailor";

// Per-field free-text remarks, keyed by the measurement field's key. Only
// filled-in remarks are stored; orders placed before remarks existed simply
// have the map absent.
export type MeasurementNotes<K extends string> = Partial<Record<K, string>>;

// Blouse & Pattu Saree Blouse — L.B (Lining Blouse) only, per the physical
// order form; there is no separate O.B (Outer Blouse) column.
export interface BlouseMeasurements {
  type: "blouse";
  length:    string;
  shoulder:  string;
  hs:        string; // Half Shoulder
  sl:        string; // Sleeve Length
  mlos:      string; // Mid-sleeve
  tlos:      string; // Total sleeve length
  ahs:       string; // Arm Hole Size
  ub:        string; // Under Bust — printed ABOVE Bust on the slip, and
  bust:      string; //   always the smaller of the two.
  waist:     string;
  fnNr:      string; // Front Neck / Neck Round
  bn:        string; // Back Neck
  dart:      string;
  dbd:       string;   // Distance Between Darts
  p:         string;   // Dart point
  sareeFall: string;
  piko:      string;
  fieldNotes?: MeasurementNotes<Exclude<keyof BlouseMeasurements, "type" | "fieldNotes">>;
}

// Salwar Kameez & Churidar. O.Shalwar / L.Shalwar were dropped from the
// order form — optional so orders stored before the removal still parse.
export interface SalwarMeasurements {
  type: "salwar";
  top: {
    oShalwar?: string;
    lShalwar?: string;
    length:   string;
    shoulder: string;
    hs:       string;
    sl:       string;
    tlcs:     string;
    ah:       string; // Arm Hole
    ub:       string; // printed above B (Bust) on the slip; always smaller
    bust:     string;
    waist:    string;
    hip:      string;
    fnNr:     string;
    bn:       string;
  };
  pant: {
    height:     string;
    hip:        string;
    waist:      string;
    kl:         string; // Knee Length
    tl:         string; // Thigh Length
    fullLength: string;
    yoke:       string;
  };
  shawl: string;
  topNotes?: MeasurementNotes<keyof SalwarMeasurements["top"]>;
  pantNotes?: MeasurementNotes<keyof SalwarMeasurements["pant"]>;
}

// Lehenga, Anarkali, Gown, Kurti, Pavadai, Other
export interface GenericMeasurements {
  type: "generic";
  bust:      string;
  waist:     string;
  hip:       string;
  length:    string;
  shoulder:  string;
  sleeve:    string;
  neckDepth: string;
  armRound:  string;
}

export type GarmentMeasurements =
  | BlouseMeasurements
  | SalwarMeasurements
  | GenericMeasurements;

export interface OrderLineItem {
  particulars: string;
  qty: number;
  amount: number; // price per piece — the line's value is qty × amount
  note?: string;  // optional free-text remark for this item
}

export interface AssignedStaff {
  id: string;
  name: string;
}

// ── Scan-to-draft-order (order slip OCR) ────────────────────────────────
// A photographed book spread is read by a vision model into a SlipExtraction,
// stored on a draft order (src/lib/db — draft_orders table) until the admin
// verifies it. Drafts never consume an order id; only confirming one runs
// the normal createOrder path.

export type ScanBookType = "Blouse" | "Salwar" | "unknown";

// Two levels only — the model is instructed to mark anything it isn't sure
// of as "low" (and leave the value empty rather than guess), so the review
// UI has an unambiguous "check this against the photo" signal.
export type ExtractionConfidence = "high" | "low";

// One measurement box from the slip. `key` uses the app's own measurement
// field keys — blouse: "length".."piko"; salwar: "top.length".."top.bn",
// "pant.height".."pant.yoke", "shawl". `value` holds digits only (the
// numbers-only rule); every other pen mark near the box lands in `note`.
export interface ExtractedField {
  key: string;
  value: string;
  note?: string;
  confidence: ExtractionConfidence;
}

export interface ExtractedLineItem {
  particulars: string;
  qty: number;
  amount: number; // per-piece price, matching OrderLineItem.amount
  note?: string;
  confidence: ExtractionConfidence;
}

export interface SlipExtraction {
  bookType: ScanBookType;
  bookTypeConfidence: ExtractionConfidence;
  billNo: string;
  date: string;    // as written in the book, e.g. "25/6"
  dueDate: string; // as written in the book
  customerName: string;
  customerNameConfidence: ExtractionConfidence;
  phone: string; // digits only
  phoneConfidence: ExtractionConfidence;
  measurements: ExtractedField[];
  lineItems: ExtractedLineItem[];
  advance: string; // digits, "" when the box is blank
  advanceConfidence: ExtractionConfidence;
  writtenTotal: string; // the handwritten Total — compared, never trusted
  writtenTotalConfidence: ExtractionConfidence;
  // Pen writing with no matching app field: Given/L.B/O.B boxes, Reminder
  // Date, notes in the sketch area, … — surfaced into the order notes.
  extraNotes: string[];
  // Set by the extractor when the photo can't be processed at all — the
  // drafts action turns these into user-facing errors before any draft is
  // created. Absent/"" means the image was usable.
  imageProblem?: "not_a_slip" | "unreadable";
}

export type DraftOrderStatus = "draft" | "confirmed" | "discarded";

export interface Order {
  id: string;
  customer: string;
  phone: string;
  dress: string;
  material: string;
  status: OrderStatus;
  amount: number;        // total (fabric cost + Σ lineItems qty × amount)
  advance: number;
  due: string;
  master: AssignedStaff | null;
  tailor: AssignedStaff | null;
  measurements: GarmentMeasurements;
  lineItems: OrderLineItem[];
  notes: string;
  sketchDataUrl: string | null;
  referenceImageUrls: string[];   // gallery, max MAX_REFERENCE_IMAGES
  materialImageUrls: string[];    // fabric photo gallery, max MAX_MATERIAL_IMAGES;
                                   // only populated on detail-level reads (findById/
                                   // create/update/findByPublicToken), like referenceImageUrls
  mainMaterialImageUrl: string | null; // materialImageUrls[0], resolved cheaply on
                                        // every read including list() — the thumbnail
                                        // shown on order cards
  cancellationCharge: number | null;
  createdAt: string;
}
