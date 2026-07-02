import type { Order, OrderStatus, Role } from "@/types";

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
export interface OrderWriteInput extends Omit<Order, "master" | "tailor" | "createdAt"> {
  masterId?: string | null;
  tailorId?: string | null;
}

export type OrderUpdateInput = Partial<OrderWriteInput>;

// The customer-facing tracking link (src/app/track/[token]/) is looked up by
// this token, never by the guessable SDS-xxx order id. Excludes master/tailor
// so internal staff identities never reach an unauthenticated visitor.
export type PublicOrder = Omit<Order, "master" | "tailor">;

export interface OrderRepository {
  list(): Promise<Order[]>;
  findById(id: string): Promise<Order | null>;
  // Only the create response carries the freshly generated public_token —
  // it's shown to staff once, right after placing the order, to build the
  // WhatsApp tracking link. No other read path needs it.
  create(input: OrderWriteInput): Promise<Order & { publicToken: string }>;
  update(id: string, patch: OrderUpdateInput): Promise<Order>;
  updateStatus(id: string, status: OrderStatus, extra?: OrderUpdateInput): Promise<Order>;
  delete(id: string): Promise<void>;
  findByPublicToken(token: string): Promise<PublicOrder | null>;
  // Atomically reserves the next id in the dress-category's series (Salwar:
  // S2131.., Blouse: B2401..) via the Postgres sequence backing it — never
  // derive an order id from client randomness or `select max(id)+1`.
  nextOrderId(dress: string): Promise<string>;
}

export interface Database {
  staff: StaffRepository;
  orders: OrderRepository;
}
