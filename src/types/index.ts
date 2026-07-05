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
  bust:      string;
  ub:        string; // Under Bust
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
    bust:     string;
    ub:       string;
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
