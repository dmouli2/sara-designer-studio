export type OrderStatus =
  | "new"
  | "cutting"
  | "cutting_done"
  | "stitching"
  | "hemming_hook" // finishing gate after stitching — admin marks it done to release to "ready"
  | "ready"
  // Some — but not all — of a multi-piece order's garments have been handed
  // over. Only deliverPiece can set this, and only an order with `pieces`
  // can ever hold it; single-piece orders go straight from ready to
  // delivered exactly as before. Never offered in the admin's manual status
  // dropdown: it describes what has physically left the shop, not a stage
  // the admin picks.
  | "partly_delivered"
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
  // A second, independent signal that the Advance box carries handwriting at
  // all. The model returning a number while claiming the box is blank is the
  // signature of a guess, and a guessed advance is money the shop never took
  // — normalizeExtraction refuses to prefill unless this is true. Optional so
  // drafts scanned before this field existed still parse (they fall back to
  // "the advance is filled if a value came back").
  advanceBoxFilled?: boolean;
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

// The shop takes money two ways at the counter. Kept deliberately small: a
// list that mirrors what actually happens is more useful than one that covers
// every payment rail in existence.
export type PaymentMethod = "cash" | "upi";

// One collection, split across the two ways the shop takes money — a customer
// paying ₹600 in notes and ₹400 by UPI is one payment, not two decisions.
// Either side may be zero; a single-method payment is simply the other side
// at zero, so callers never branch on "is this split".
export interface PaymentSplit {
  cash: number;
  upi: number;
}

// ── Multi-piece orders ──────────────────────────────────────────────────
// One customer, one order, several garments cut to the SAME measurements —
// the shop's common "three blouses from one saree" case. Each garment can
// carry its own delivery date and be handed over on its own day.
//
// `Order.pieces` is null for every order that isn't split this way, which is
// every order placed before this existed and every single-garment order
// placed after. Null is not "no pieces" — it means "this order is one
// garment", and the whole delivery flow behaves exactly as it always has.

export type OrderPieceStatus = "pending" | "delivered";

// Who supplied the cloth. Historically one choice for the whole order, held
// in the free-text `Order.material`; now recordable per garment, because a
// customer bringing cloth for two blouses and buying the third from the shop
// is a real order the app could not describe.
export type MaterialSource = "shop" | "customer";

export interface OrderPiece {
  // Stable for the life of the order and never reused, so a payment or an
  // alteration can point at a specific garment even after others are gone.
  id: string;
  label: string;             // "Blouse 1" by default; the admin can rename it
  due: string;               // this garment's own delivery date (yyyy-mm-dd)
  status: OrderPieceStatus;
  // The day the garment actually went home with the customer, as a calendar
  // date ("YYYY-MM-DD") like every other human-meaningful date in the app.
  // Chosen by the admin — it defaults to today but is often a day or two ago,
  // because the shop records the hand-over when it gets a moment, not at the
  // counter. Only the payment ledger keeps a true timestamp.
  deliveredAt: string | null;
  // Absent means "whatever the order's material says" — true of every piece
  // written before this was recorded, and of every order whose garments all
  // come from the same place (which is most of them).
  materialSource?: MaterialSource;
}

// A practical ceiling, enforced in the wizard and in createOrder. Well above
// anything the shop takes in one order, low enough that a fat-fingered
// stepper can't write a thousand-entry array.
export const MAX_ORDER_PIECES = 12;

// ── Post-delivery alterations ───────────────────────────────────────────
// An alteration is an episode in a delivered order's life, not a stage of
// stitching — the garment was finished and handed over, then came back. It
// can happen more than once, so it's a list, and the order's `status` stays
// "delivered" throughout: revenue, the delivered count and every Reports
// figure are deliberately untouched by an alteration.
//
// The open record (if any) is the one with no redeliveredAt — see
// openAlteration() in src/lib/utils.ts, the single definition of "is this
// order in alteration right now".

export interface AlterationRecord {
  id: string;
  reason: string;
  // Which garment came back, on a multi-piece order — the piece's label at
  // the time, so the record still reads correctly if the piece is renamed.
  pieceLabel: string | null;
  receivedAt: string;            // taken back in from the customer (yyyy-mm-dd)
  promisedAt: string;            // when we said it would be ready (yyyy-mm-dd)
  completedAt: string | null;    // alteration work finished
  redeliveredAt: string | null;  // handed back — closes the record
}

// ── Payment ledger ──────────────────────────────────────────────────────
// Money collected AFTER placement, one entry per hand-over. A multi-piece
// order can be paid off across several visits, so a single amount+method
// pair can't describe it.
//
// This is an audit trail layered over the existing two-entry model, not a
// replacement for it: `Order.finalPayment` stays the sum of these entries
// and `Order.finalPaymentMethod` the most recent one's method, so
// orderBalance() and every Reports figure keep working untouched. The
// advance is deliberately NOT in here — it has its own two fields.
export interface OrderPayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  at: string;              // ISO timestamp
  pieceId: string | null;  // the piece hand-over it came with, when there was one
}

export interface Order {
  id: string;
  customer: string;
  phone: string;
  dress: string;
  material: string;
  status: OrderStatus;
  amount: number;        // total (fabric cost + Σ lineItems qty × amount)
  // Money received, in two entries. Balance is amount - advance - finalPayment
  // — always via orderBalance() in src/lib/utils.ts, never inline.
  advance: number;                       // taken at placement
  advanceMethod: PaymentMethod | null;   // null for a zero advance, an order taken
                                         // before methods were captured, or one
                                         // whose advance was split — see advanceSplit
  // How the advance actually arrived. Null means it wasn't split — read
  // advanceMethod instead, which covers every order taken before this existed.
  advanceSplit: PaymentSplit | null;
  finalPayment: number;                  // balance collected at delivery; 0 until then
  // Null where it was never recorded AND where a collection was split: the
  // `payments` ledger is the breakdown in that case, and it is what the UI
  // reads whenever it has entries.
  finalPaymentMethod: PaymentMethod | null;
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
  // The day the order was handed over — the admin's choice, not a stamp.
  // Null until it is delivered, and for orders delivered before this was
  // recorded (see supabase/migrations/0013_order_delivered_on.sql).
  deliveredOn: string | null;
  // Null for a single-garment order — see OrderPiece above. Present only on
  // orders deliberately split into several garments.
  pieces: OrderPiece[] | null;
  // Every alteration episode this order has been through, oldest first.
  // Empty for the overwhelming majority of orders.
  alterations: AlterationRecord[];
  // Post-placement collections, oldest first. Empty until money is taken at
  // a hand-over; `finalPayment` remains the authoritative total.
  payments: OrderPayment[];
  createdAt: string;
}
