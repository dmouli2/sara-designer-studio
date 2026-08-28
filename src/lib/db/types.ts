import type { DraftOrderStatus, Order, OrderStatus, Role, SlipExtraction } from "@/types";

export interface StaffAccount {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface CreateStaffInput {
  username: string;
  passwordHash: string;
  name: string;
  role: Role;
}

export interface UpdateStaffInput {
  name?: string;
  role?: Role;
  active?: boolean;
}

export interface StaffListFilter {
  role?: Role;
  activeOnly?: boolean;
}

export interface StaffRepository {
  findByUsername(username: string): Promise<StaffAccount | null>;
  findById(id: string): Promise<StaffAccount | null>;
  list(filter?: StaffListFilter): Promise<StaffAccount[]>;
  create(input: CreateStaffInput): Promise<StaffAccount>;
  update(id: string, patch: UpdateStaffInput): Promise<StaffAccount>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
}

// Order.master / Order.tailor carry only a display name today. Writes take
// explicit ids (matching the orders table's master_id/tailor_id FKs) so that
// resolving Order shape to include ids later is a read-side change only.
// mainMaterialImageUrl is excluded too — it's derived on read (always
// materialImageUrls[0]), never something a caller supplies directly.
export interface OrderWriteInput extends Omit<Order, "master" | "tailor" | "createdAt" | "mainMaterialImageUrl"> {
  masterId?: string | null;
  tailorId?: string | null;
}

export type OrderUpdateInput = Partial<OrderWriteInput>;

// The customer-facing tracking link (src/app/track/[token]/) is looked up by
// this token, never by the guessable SDS-xxx order id. Excludes master/tailor
// so internal staff identities never reach an unauthenticated visitor, and
// excludes measurements since customers don't need their own measurements
// echoed back to them.
export type PublicOrder = Omit<Order, "master" | "tailor" | "measurements">;

// Server-side list narrowing — queues ask only for their own assignments and
// statuses instead of hauling the whole orders table over the wire, and the
// admin list pages through history instead of loading all of it.
export interface OrderListFilter {
  statuses?: OrderStatus[];
  masterId?: string;
  tailorId?: string;
  limit?: number;
  offset?: number;
}

// A delivered/cancelled order whose images are due for cleanup — just enough
// to delete the storage objects and blank the columns.
export interface OrderImageCleanupCandidate {
  id: string;
  sketchDataUrl: string | null;
  referenceImageUrls: string[];
  materialImageUrls: string[];
}

export interface OrderRepository {
  list(filter?: OrderListFilter): Promise<Order[]>;
  findById(id: string): Promise<Order | null>;
  // Only the create response carries the freshly generated public_token —
  // it's shown to staff right after placing the order, to build the WhatsApp
  // tracking link.
  create(input: OrderWriteInput): Promise<Order & { publicToken: string }>;
  // The tracking token on its own, for re-sharing the link from the admin
  // detail screen long after placement. Deliberately not a field on Order:
  // that would carry every customer's token into the orders list and both
  // role queues, which have no use for it.
  findPublicToken(id: string): Promise<string | null>;
  update(id: string, patch: OrderUpdateInput): Promise<Order>;
  updateStatus(id: string, status: OrderStatus, extra?: OrderUpdateInput): Promise<Order>;
  delete(id: string): Promise<void>;
  findByPublicToken(token: string): Promise<PublicOrder | null>;
  // Atomically reserves the next id in the dress-category's series (Salwar:
  // S2131.., Blouse: B2401..) via the Postgres sequence backing it — never
  // derive an order id from client randomness or `select max(id)+1`.
  nextOrderId(dress: string): Promise<string>;
  // Delivered/cancelled orders older than the cutoff that still hold image
  // data — consumed by the daily storage-cleanup cron.
  listImageCleanupCandidates(cutoffIso: string): Promise<OrderImageCleanupCandidate[]>;
}

// Shop fabric price list (₹/metre), managed by the admin from the new-order
// wizard. Orders snapshot the fabric into their `material` text, so fabric
// edits/deletes never affect existing orders.
export interface Fabric {
  id: string;
  name: string;
  price: number;
}

export interface FabricWriteInput {
  name: string;
  price: number;
}

export interface FabricRepository {
  list(): Promise<Fabric[]>;
  create(input: FabricWriteInput): Promise<Fabric>;
  update(id: string, patch: Partial<FabricWriteInput>): Promise<Fabric>;
  delete(id: string): Promise<void>;
}

// A scanned order slip waiting for admin verification. Deliberately has no
// order id — drafts never advance the order-id sequences; confirming one
// runs the normal createOrder path, which is where the real S…/B… id comes
// from (see supabase/migrations/0008_draft_orders.sql).
export interface DraftOrder {
  id: string;
  dress: string; // "Blouse" | "Salwar" | "" when the scan couldn't tell
  scanImagePath: string;
  extraction: SlipExtraction;
  warnings: string[];
  status: DraftOrderStatus;
  confirmedOrderId: string | null;
  createdAt: string;
}

// The id is supplied by the caller (crypto.randomUUID() in the drafts
// action) so the scan photo's storage path can embed it before the row is
// inserted — see createDraftFromScan.
export interface DraftOrderWriteInput {
  id: string;
  dress: string;
  scanImagePath: string;
  extraction: SlipExtraction;
  warnings: string[];
}

export interface DraftOrderRepository {
  // Pending drafts only (status = 'draft'), newest first — confirmed and
  // discarded drafts are history, not work to do.
  list(): Promise<DraftOrder[]>;
  findById(id: string): Promise<DraftOrder | null>;
  create(input: DraftOrderWriteInput): Promise<DraftOrder>;
  updateStatus(id: string, status: DraftOrderStatus, confirmedOrderId?: string): Promise<DraftOrder>;
  delete(id: string): Promise<void>;
}

export interface Database {
  staff: StaffRepository;
  orders: OrderRepository;
  fabrics: FabricRepository;
  drafts: DraftOrderRepository;
}
