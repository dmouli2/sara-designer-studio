import { getSupabaseClient } from "../../supabase/client";
import { getImageStorage } from "../../storage";
import type { OrderRepository, OrderWriteInput, OrderUpdateInput } from "../types";
import type { Order, OrderStatus, GarmentMeasurements, OrderLineItem } from "@/types";

interface OrderRow {
  id: string;
  customer: string;
  phone: string;
  dress: string;
  material: string;
  status: OrderStatus;
  amount: number;
  advance: number;
  due: string;
  master_id: string | null;
  tailor_id: string | null;
  measurements: GarmentMeasurements;
  line_items: OrderLineItem[];
  notes: string;
  sketch_data_url: string | null;
  reference_image_url: string | null;
  created_at: string;
  public_token: string;
}

// Columns selected for list views, which never render sketch/reference images —
// keeps those (potentially large, pre-Storage-migration) values off the wire.
const LIST_COLUMNS =
  "id, customer, phone, dress, material, status, amount, advance, due, master_id, tailor_id, measurements, line_items, notes, created_at";

async function resolveNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => !!id))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await getSupabaseClient().from("staff").select("id, name").in("id", uniqueIds);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
}

function toAssignedStaff(id: string | null, names: Map<string, string>) {
  if (!id) return null;
  const name = names.get(id);
  return name ? { id, name } : null;
}

function toOrder(row: OrderRow, names: Map<string, string>): Order {
  return {
    id: row.id,
    customer: row.customer,
    phone: row.phone,
    dress: row.dress,
    material: row.material,
    status: row.status,
    amount: row.amount,
    advance: row.advance,
    due: row.due,
    master: toAssignedStaff(row.master_id, names),
    tailor: toAssignedStaff(row.tailor_id, names),
    measurements: row.measurements,
    lineItems: row.line_items,
    notes: row.notes,
    sketchDataUrl: row.sketch_data_url,
    referenceImageUrl: row.reference_image_url,
    createdAt: row.created_at,
  };
}

// `sketch_data_url`/`reference_image_url` hold Storage paths, not image bytes —
// resolve them to fetchable (signed) URLs for anything that renders the image.
async function resolveImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  return getImageStorage().getSignedUrl(path);
}

async function toOrderWithImages(row: OrderRow, names: Map<string, string>): Promise<Order> {
  const [sketchDataUrl, referenceImageUrl] = await Promise.all([
    resolveImageUrl(row.sketch_data_url),
    resolveImageUrl(row.reference_image_url),
  ]);
  return { ...toOrder(row, names), sketchDataUrl, referenceImageUrl };
}

function toInsertRow(input: OrderWriteInput) {
  return {
    id: input.id,
    customer: input.customer,
    phone: input.phone,
    dress: input.dress,
    material: input.material,
    status: input.status,
    amount: input.amount,
    advance: input.advance,
    due: input.due,
    master_id: input.masterId ?? null,
    tailor_id: input.tailorId ?? null,
    measurements: input.measurements,
    line_items: input.lineItems,
    notes: input.notes,
    sketch_data_url: input.sketchDataUrl,
    reference_image_url: input.referenceImageUrl,
  };
}

function toUpdateRow(patch: OrderUpdateInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.customer !== undefined) row.customer = patch.customer;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.dress !== undefined) row.dress = patch.dress;
  if (patch.material !== undefined) row.material = patch.material;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.amount !== undefined) row.amount = patch.amount;
  if (patch.advance !== undefined) row.advance = patch.advance;
  if (patch.due !== undefined) row.due = patch.due;
  if (patch.masterId !== undefined) row.master_id = patch.masterId;
  if (patch.tailorId !== undefined) row.tailor_id = patch.tailorId;
  if (patch.measurements !== undefined) row.measurements = patch.measurements;
  if (patch.lineItems !== undefined) row.line_items = patch.lineItems;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.sketchDataUrl !== undefined) row.sketch_data_url = patch.sketchDataUrl;
  if (patch.referenceImageUrl !== undefined) row.reference_image_url = patch.referenceImageUrl;
  return row;
}

export function createSupabaseOrderRepository(): OrderRepository {
  return {
    async list() {
      const { data, error } = await getSupabaseClient()
        .from("orders")
        .select(LIST_COLUMNS)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Omit<OrderRow, "sketch_data_url" | "reference_image_url">[];
      const names = await resolveNames(rows.flatMap((r) => [r.master_id, r.tailor_id]));
      return rows.map((row) =>
        toOrder({ ...row, sketch_data_url: null, reference_image_url: null }, names)
      );
    },

    async findById(id: string) {
      const { data, error } = await getSupabaseClient()
        .from("orders")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const row = data as OrderRow;
      const names = await resolveNames([row.master_id, row.tailor_id]);
      return toOrderWithImages(row, names);
    },

    async create(input: OrderWriteInput) {
      const { data, error } = await getSupabaseClient()
        .from("orders")
        .insert(toInsertRow(input))
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      const row = data as OrderRow;
      const names = await resolveNames([row.master_id, row.tailor_id]);
      const order = await toOrderWithImages(row, names);
      return { ...order, publicToken: row.public_token };
    },

    async update(id: string, patch: OrderUpdateInput) {
      const { data, error } = await getSupabaseClient()
        .from("orders")
        .update(toUpdateRow(patch))
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      const row = data as OrderRow;
      const names = await resolveNames([row.master_id, row.tailor_id]);
      return toOrderWithImages(row, names);
    },

    async updateStatus(id: string, status: OrderStatus, extra?: OrderUpdateInput) {
      return this.update(id, { ...extra, status });
    },

    async delete(id: string) {
      const { error } = await getSupabaseClient().from("orders").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },

    // Public route lookup (src/app/track/[token]/) — deliberately skips
    // resolveNames (empty map) so master/tailor identities are never even
    // fetched, then strips them from the response as defense in depth.
    async findByPublicToken(token: string) {
      const { data, error } = await getSupabaseClient()
        .from("orders")
        .select("*")
        .eq("public_token", token)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const row = data as OrderRow;
      const order = await toOrderWithImages(row, new Map());
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { master, tailor, ...publicOrder } = order;
      return publicOrder;
    },
  };
}
