export type OrderStatus =
  | "new"
  | "cutting"
  | "cutting_done"
  | "stitching"
  | "ready"
  | "delivered";

export type Role = "admin" | "master" | "tailor";

// Dual measurement (Lining / Outer) used in blouse forms
export interface DualMeas {
  lb: string; // lining blouse
  ob: string; // outer blouse
}

// Blouse & Pattu Saree Blouse
export interface BlouseMeasurements {
  type: "blouse";
  length:    DualMeas;
  shoulder:  DualMeas;
  hs:        DualMeas; // Half Shoulder
  sl:        DualMeas; // Sleeve Length
  mlos:      DualMeas; // Mid-sleeve
  tlos:      DualMeas; // Total sleeve length
  ahs:       DualMeas; // Arm Hole Size
  bust:      DualMeas;
  ub:        DualMeas; // Under Bust
  waist:     DualMeas;
  fnNr:      DualMeas; // Front Neck / Neck Round
  bn:        DualMeas; // Back Neck
  dart:      string;
  dbd:       string;   // Distance Between Darts
  p:         string;   // Dart point
  sareeFall: string;
  piko:      string;
}

// Salwar Kameez & Churidar
export interface SalwarMeasurements {
  type: "salwar";
  top: {
    oShalwar: string;
    lShalwar: string;
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
    height:   string;
  };
  pant: {
    hip:        string;
    waist:      string;
    kl:         string; // Knee Length
    tl:         string; // Thigh Length
    fullLength: string;
    yoke:       string;
  };
  shawl: string;
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
  amount: number;
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
  amount: number;        // total (sum of lineItems.amount)
  advance: number;
  due: string;
  master: AssignedStaff | null;
  tailor: AssignedStaff | null;
  measurements: GarmentMeasurements;
  lineItems: OrderLineItem[];
  notes: string;
  sketchDataUrl: string | null;
  referenceImageUrl: string | null;
  createdAt: string;
}
