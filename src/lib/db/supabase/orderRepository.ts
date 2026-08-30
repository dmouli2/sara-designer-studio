import { getSupabaseClient } from "../../supabase/client";
import { getImageStorage } from "../../storage";
import type {
  OrderRepository,
  OrderWriteInput,
  OrderUpdateInput,
  OrderListFilter,
  OrderImageCleanupCandidate,
} from "../types";
import type {
  AlterationRecord,
  Order,
  OrderStatus,
  GarmentMeasurements,
  SalwarMeasurements,
  OrderLineItem,
  OrderPayment,
  OrderPiece,
  PaymentSplit,
  PaymentMethod,
} from "@/types";

interface EmbeddedStaff {
  id: string;
  name: string;
}

interface OrderRow {
  id: string;
  customer: string;
  phone: string;
  dress: string;
  material: string;
  status: OrderStatus;
  amount: number;
  advance: number;
  advance_method: PaymentMethod | null;
  advance_split: PaymentSplit | null; // added in 0014; null on every earlier row
  final_payment: number | null;
  final_payment_method: PaymentMethod | null;
  due: string;
  // Assigned staff arrive embedded in the same query (PostgREST join through
  // the master_id/tailor_id FKs) — no follow-up staff lookup.
  master?: EmbeddedStaff | null;
  tailor?: EmbeddedStaff | null;
  measurements: GarmentMeasurements;
  line_items: OrderLineItem[];
  notes: string;
  sketch_data_url: string | null;
  reference_image_urls: string[];
  material_image_urls: string[];
  cancellation_charge: number | null;
  delivered_on: string | null; // added in 0013; null on every earlier row
  // Added in 0012. Null/absent on every row written before it — see the
  // defaults applied in toOrder below.
  pieces: OrderPiece[] | null;
  alterations: AlterationRecord[] | null;
  payments: OrderPayment[] | null;
  created_at: string;
  public_token: string;
}

const STAFF_EMBEDS =
  "master:staff!orders_master_id_fkey(id, name), tailor:staff!orders_tailor_id_fkey(id, name)";

// Columns selected for list views, which never render sketch/reference
// images — keeps those (potentially large, pre-Storage-migration) values off
// the wire. material_image_urls is the one exception: it's just short
// Storage paths (cheap), needed to resolve each row's single main-photo
// thumbnail for the order card (see list() below).
const LIST_COLUMNS = `id, customer, phone, dress, material, status, amount, advance, advance_method, final_payment, final_payment_method, due, measurements, line_items, notes, cancellation_charge, delivered_on, advance_split, pieces, alterations, payments, created_at, material_image_urls, ${STAFF_EMBEDS}`;

const DETAIL_COLUMNS = `*, ${STAFF_EMBEDS}`;

// Blouse measurements used to be stored as { lb, ob } pairs, before O.B was
// dropped and the columns became plain strings (see
// supabase/migrations/0005_cancellation_and_multi_reference_images.sql's
// sibling type change in src/types/index.ts). Orders written before that
// change still have the old shape in their `measurements` jsonb — normalize
// on read rather than requiring every stored row to be migrated up front.
function normalizeBlouseMeasurements(raw: GarmentMeasurements): GarmentMeasurements {
  const toSingle = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "lb" in v) return String((v as { lb?: unknown }).lb ?? "");
    return "";
  };
  const m = raw as unknown as Record<string, unknown>;
  return {
    type: "blouse",
    length: toSingle(m.length),
    shoulder: toSingle(m.shoulder),
    hs: toSingle(m.hs),
    sl: toSingle(m.sl),
    mlos: toSingle(m.mlos),
    tlos: toSingle(m.tlos),
    ahs: toSingle(m.ahs),
    bust: toSingle(m.bust),
    ub: toSingle(m.ub),
    waist: toSingle(m.waist),
    fnNr: toSingle(m.fnNr),
    bn: toSingle(m.bn),
    dart: toSingle(m.dart),
    dbd: toSingle(m.dbd),
    p: toSingle(m.p),
    sareeFall: toSingle(m.sareeFall),
    piko: toSingle(m.piko),
  };
}

// Salwar's Height field moved from M. Top to M. Pant (see the sibling type
// change in src/types/index.ts). Orders written before that change still
// have it nested under `top` — move it over on read rather than requiring
// every stored row to be migrated up front.
function normalizeSalwarMeasurements(raw: GarmentMeasurements): GarmentMeasurements {
  const m = raw as unknown as { top: Record<string, unknown>; pant: Record<string, unknown> };
  const legacyHeight = m.top?.height;
  if (m.pant?.height || legacyHeight === undefined) return raw;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { height: _height, ...restTop } = m.top;
  return {
    ...(raw as SalwarMeasurements),
    top: restTop as SalwarMeasurements["top"],
    pant: { ...(raw as SalwarMeasurements).pant, height: String(legacyHeight ?? "") },
  };
}

function normalizeMeasurements(raw: GarmentMeasurements): GarmentMeasurements {
  if (!raw) return raw;
  if (raw.type === "blouse") return normalizeBlouseMeasurements(raw);
  if (raw.type === "salwar") return normalizeSalwarMeasurements(raw);
  return raw;
}

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    customer: row.customer,
    phone: row.phone,
    dress: row.dress,
    material: row.material,
    status: row.status,
    amount: row.amount,
    advance: row.advance,
    advanceMethod: row.advance_method ?? null,
    advanceSplit: row.advance_split ?? null,
    finalPayment: row.final_payment ?? 0,
    finalPaymentMethod: row.final_payment_method ?? null,
    due: row.due,
    master: row.master ?? null,
    tailor: row.tailor ?? null,
    measurements: normalizeMeasurements(row.measurements),
    lineItems: row.line_items,
    notes: row.notes,
    sketchDataUrl: row.sketch_data_url,
    referenceImageUrls: row.reference_image_urls,
    materialImageUrls: row.material_image_urls,
    // Resolved separately (needs a Storage round trip) — see
    // toOrderWithImages and list() below, which both override this.
    mainMaterialImageUrl: null,
    cancellationCharge: row.cancellation_charge,
    deliveredOn: row.delivered_on ?? null,
    // Null pieces is meaningful (a single-garment order) and is preserved as
    // null; the two lists default to empty, which is what every pre-0012 row
    // means. See supabase/migrations/0012_pieces_alterations_payments.sql.
    pieces: row.pieces ?? null,
    alterations: row.alterations ?? [],
    payments: row.payments ?? [],
    createdAt: row.created_at,
  };
}

// `sketch_data_url`/`reference_image_urls`/`material_image_urls` hold
// Storage paths, not image bytes — resolve them to fetchable (signed) URLs
// for anything that renders the image(s).
async function resolveImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  return getImageStorage().getSignedUrl(path);
}

// Drops any path whose signed URL failed to resolve rather than surfacing a
// null into an array the UI expects to be all valid image URLs.
async function resolveImageUrls(paths: string[]): Promise<string[]> {
  const urls = await Promise.all(paths.map((path) => getImageStorage().getSignedUrl(path)));
  return urls.filter((url): url is string => url !== null);
}

async function toOrderWithImages(row: OrderRow): Promise<Order> {
  const [sketchDataUrl, referenceImageUrls, materialImageUrls] = await Promise.all([
    resolveImageUrl(row.sketch_data_url),
    resolveImageUrls(row.reference_image_urls),
    resolveImageUrls(row.material_image_urls),
  ]);
  return {
    ...toOrder(row),
    sketchDataUrl,
    referenceImageUrls,
    materialImageUrls,
    mainMaterialImageUrl: materialImageUrls[0] ?? null,
  };
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
    advance_method: input.advanceMethod,
    advance_split: input.advanceSplit,
    final_payment: input.finalPayment,
    final_payment_method: input.finalPaymentMethod,
    due: input.due,
    master_id: input.masterId ?? null,
    tailor_id: input.tailorId ?? null,
    measurements: input.measurements,
    line_items: input.lineItems,
    notes: input.notes,
    sketch_data_url: input.sketchDataUrl,
    reference_image_urls: input.referenceImageUrls,
    material_image_urls: input.materialImageUrls,
    cancellation_charge: input.cancellationCharge,
    delivered_on: input.deliveredOn,
    pieces: input.pieces,
    alterations: input.alterations,
    payments: input.payments,
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
  if (patch.advanceMethod !== undefined) row.advance_method = patch.advanceMethod;
  if (patch.advanceSplit !== undefined) row.advance_split = patch.advanceSplit;
  if (patch.finalPayment !== undefined) row.final_payment = patch.finalPayment;
  if (patch.finalPaymentMethod !== undefined) row.final_payment_method = patch.finalPaymentMethod;
  if (patch.due !== undefined) row.due = patch.due;
  if (patch.masterId !== undefined) row.master_id = patch.masterId;
  if (patch.tailorId !== undefined) row.tailor_id = patch.tailorId;
  if (patch.measurements !== undefined) row.measurements = patch.measurements;
  if (patch.lineItems !== undefined) row.line_items = patch.lineItems;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.sketchDataUrl !== undefined) row.sketch_data_url = patch.sketchDataUrl;
  if (patch.referenceImageUrls !== undefined) row.reference_image_urls = patch.referenceImageUrls;
  if (patch.materialImageUrls !== undefined) row.material_image_urls = patch.materialImageUrls;
  if (patch.cancellationCharge !== undefined) row.cancellation_charge = patch.cancellationCharge;
  if (patch.deliveredOn !== undefined) row.delivered_on = patch.deliveredOn;
  if (patch.pieces !== undefined) row.pieces = patch.pieces;
  if (patch.alterations !== undefined) row.alterations = patch.alterations;
  if (patch.payments !== undefined) row.payments = patch.payments;
  return row;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createSupabaseOrderRepository(): OrderRepository {
  return {
    async list(filter?: OrderListFilter) {
      let query = getSupabaseClient()
        .from("orders")
        .select(LIST_COLUMNS)
        .order("created_at", { ascending: false });
      if (filter?.statuses?.length) query = query.in("status", filter.statuses);
      if (filter?.masterId) query = query.eq("master_id", filter.masterId);
      if (filter?.tailorId) query = query.eq("tailor_id", filter.tailorId);
      if (filter?.limit !== undefined) {
        const offset = filter.offset ?? 0;
        query = query.range(offset, offset + filter.limit - 1);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Omit<OrderRow, "sketch_data_url" | "reference_image_urls">[];

      // One batch Storage call for every row's first material photo, instead
      // of a signed-url round trip per order — the difference between one
      // request and up to `limit` requests on a paginated list.
      const mainPaths = rows.map((row) => row.material_image_urls?.[0]).filter((p): p is string => !!p);
      const mainUrls = await getImageStorage().getSignedUrls(mainPaths);
      const mainUrlByPath = new Map(mainPaths.map((p, i) => [p, mainUrls[i] ?? null]));

      return rows.map((row) => {
        const order = toOrder({ ...row, sketch_data_url: null, reference_image_urls: [] });
        const mainPath = row.material_image_urls?.[0];
        return {
          ...order,
          materialImageUrls: [], // full gallery not resolved in list mode
          mainMaterialImageUrl: mainPath ? mainUrlByPath.get(mainPath) ?? null : null,
        };
      });
    },

    async findById(id: string) {
      const { data, error } = await getSupabaseClient()
        .from("orders")
        .select(DETAIL_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return toOrderWithImages(data as unknown as OrderRow);
    },

    async create(input: OrderWriteInput) {
      const { data, error } = await getSupabaseClient()
        .from("orders")
        .insert(toInsertRow(input))
        .select(DETAIL_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      const row = data as unknown as OrderRow;
      const order = await toOrderWithImages(row);
      return { ...order, publicToken: row.public_token };
    },

    // Just the token — no images resolved, no staff embeds, no measurements.
    async findPublicToken(id: string) {
      const { data, error } = await getSupabaseClient()
        .from("orders")
        .select("public_token")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as { public_token: string } | null)?.public_token ?? null;
    },

    async update(id: string, patch: OrderUpdateInput) {
      const { data, error } = await getSupabaseClient()
        .from("orders")
        .update(toUpdateRow(patch))
        .eq("id", id)
        .select(DETAIL_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return toOrderWithImages(data as unknown as OrderRow);
    },

    async updateStatus(id: string, status: OrderStatus, extra?: OrderUpdateInput) {
      return this.update(id, { ...extra, status });
    },

    async delete(id: string) {
      const { error } = await getSupabaseClient().from("orders").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },

    // Public route lookup (src/app/track/[token]/) — deliberately selects
    // without the staff embeds so master/tailor identities are never even
    // fetched, then strips them (and measurements, which customers don't
    // need to see) from the response as defense in depth.
    async findByPublicToken(token: string) {
      // `public_token` is a uuid column (migration 0002), so Postgres rejects
      // anything that is not one with "invalid input syntax for type uuid"
      // rather than simply matching no rows. That turned every crawler and
      // mistyped tracking link into a thrown server error -- the visitor
      // still got the not-found page, but each hit was logged as a runtime
      // failure. A token that cannot be a uuid is just a token nobody has.
      if (!UUID_RE.test(token)) return null;

      const { data, error } = await getSupabaseClient()
        .from("orders")
        .select("*")
        .eq("public_token", token)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const order = await toOrderWithImages(data as OrderRow);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { master, tailor, measurements, ...publicOrder } = order;
      return publicOrder;
    },

    // Wraps the `next_order_id` Postgres function (S2131.. / B2401..) —
    // see supabase/migrations/0003_order_id_sequences.sql. A single RPC
    // round trip keeps the sequence bump and prefix formatting atomic.
    async nextOrderId(dress: string) {
      const { data, error } = await getSupabaseClient().rpc("next_order_id", { dress_type: dress });
      if (error) throw new Error(error.message);
      return data as string;
    },

    // Feeds the daily storage-cleanup cron (src/app/api/cleanup-images/):
    // finished orders past the retention window that still carry image data.
    async listImageCleanupCandidates(cutoffIso: string) {
      const { data, error } = await getSupabaseClient()
        .from("orders")
        .select("id, sketch_data_url, reference_image_urls, material_image_urls")
        .in("status", ["delivered", "cancelled"])
        .lt("created_at", cutoffIso)
        .or("sketch_data_url.not.is.null,reference_image_urls.neq.{},material_image_urls.neq.{}");
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Pick<
        OrderRow,
        "id" | "sketch_data_url" | "reference_image_urls" | "material_image_urls"
      >[];
      return rows.map(
        (row): OrderImageCleanupCandidate => ({
          id: row.id,
          sketchDataUrl: row.sketch_data_url,
          referenceImageUrls: row.reference_image_urls ?? [],
          materialImageUrls: row.material_image_urls ?? [],
        })
      );
    },
  };
}
