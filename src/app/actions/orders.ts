"use server";

import { revalidatePath, refresh } from "next/cache";
import { requireRole } from "@/lib/dal";
import { getDb, type OrderWriteInput, type OrderUpdateInput, type OrderListFilter } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";
import {
  MAX_REFERENCE_IMAGES,
  MAX_MATERIAL_IMAGES,
  type AlterationRecord,
  type GarmentMeasurements,
  type Order,
  type OrderLineItem,
  type OrderPayment,
  type OrderPiece,
  type OrderStatus,
  type PaymentMethod,
} from "@/types";
import { openAlteration, orderBalance, shopToday } from "@/lib/utils";
import { buildPieces, reconcilePieces, type OrderPieceDraft } from "@/lib/pieces";
import { assertAlterationsEnabled } from "@/lib/features";

const ALL_ROLES = ["admin", "master", "tailor"] as const;

function revalidateOrderPaths(id: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/master/orders/${id}`);
  revalidatePath(`/tailor/orders/${id}`);
  revalidatePath("/master/queue");
  revalidatePath("/tailor/queue");
}

// Photos arrive from the wizard as multipart Files (never as base64 strings
// inside the action arguments — React's deserializer hard-caps string
// characters inside nested arrays at 1e6, which real orders exceeded with
// just two photos). Re-encoded to a data URL here only as the hand-off
// format the ImageStorage port expects.
async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type || "image/jpeg"};base64,${buffer.toString("base64")}`;
}

function filesFrom(photos: FormData, field: string, max: number): File[] {
  return photos
    .getAll(field)
    .filter((entry): entry is File => entry instanceof File)
    .slice(0, max);
}

// Each kind uploads to fixed, predictable slots (sketch.png,
// reference-1..8.jpg, material-1..8.jpg) so deleteOrder can clean them up
// without needing to know how many were used. material-1.jpg is always the
// "main" photo used as the order-card thumbnail.
async function storeSketch(orderId: string, photos: FormData): Promise<string | null> {
  const [file] = filesFrom(photos, "sketch", 1);
  if (!file) return null;
  const path = `orders/${orderId}/sketch.png`;
  await getImageStorage().upload(path, await fileToDataUrl(file));
  return path;
}

async function storePhotos(orderId: string, files: File[], slotPrefix: string): Promise<string[]> {
  return Promise.all(
    files.map(async (file, i) => {
      const path = `orders/${orderId}/${slotPrefix}-${i + 1}.jpg`;
      await getImageStorage().upload(path, await fileToDataUrl(file));
      return path;
    })
  );
}

export async function getOrders(filter?: OrderListFilter): Promise<Order[]> {
  await requireRole([...ALL_ROLES]);
  return getDb().orders.list(filter);
}

export async function getOrder(id: string): Promise<Order | null> {
  await requireRole([...ALL_ROLES]);
  return getDb().orders.findById(id);
}

// The customer tracking token, for re-sharing the link from the admin detail
// screen. Admin-only on purpose: it is a bearer credential for that order's
// public page, and master/tailor have no reason to hand it out.
export async function getOrderShareToken(id: string): Promise<string | null> {
  await requireRole(["admin"]);
  return getDb().orders.findPublicToken(id);
}

// `photos` carries the images as multipart Files under the fields "sketch"
// (at most one), "reference" and "material" (repeated) — see the transport
// note on fileToDataUrl above for why they must not ride inside `input`.
export async function createOrder(
  input: Omit<
    OrderWriteInput,
    | "id"
    | "cancellationCharge"
    | "sketchDataUrl"
    | "referenceImageUrls"
    | "materialImageUrls"
    | "pieces"
    | "alterations"
    | "payments"
  > & { pieces?: OrderPieceDraft[] },
  photos: FormData
): Promise<Order & { publicToken: string }> {
  await requireRole(["admin"]);
  if (!input.due) {
    throw new Error("Delivery date is required.");
  }
  const { pieces: pieceDrafts, ...orderInput } = input;
  const pieces = buildPieces(pieceDrafts, input.due);
  const referenceFiles = filesFrom(photos, "reference", MAX_REFERENCE_IMAGES);
  const materialFiles = filesFrom(photos, "material", MAX_MATERIAL_IMAGES);
  // Scanned book orders (scanOrder="1") have no fabric on hand at scan time,
  // so the photo is optional there — cards fall back to a no-photo
  // placeholder. Manual orders still require at least one.
  if (materialFiles.length === 0 && photos.get("scanOrder") !== "1") {
    throw new Error("At least one material photo is required.");
  }

  // Reserved once per order, from the dress-category's own DB sequence —
  // never generated client-side. See supabase/migrations/0003_order_id_sequences.sql.
  const id = await getDb().orders.nextOrderId(input.dress);

  const [sketchDataUrl, referenceImageUrls, materialImageUrls] = await Promise.all([
    storeSketch(id, photos),
    storePhotos(id, referenceFiles, "reference"),
    storePhotos(id, materialFiles, "material"),
  ]);

  // cancellationCharge only ever exists once an order is cancelled — see
  // cancelOrder below — never something a new order carries in.
  const created = await getDb().orders.create({
    ...orderInput,
    id,
    sketchDataUrl,
    referenceImageUrls,
    materialImageUrls,
    cancellationCharge: null,
    pieces,
    // A brand-new order has been through neither.
    alterations: [],
    payments: [],
  });
  revalidatePath("/admin/orders");
  refresh();
  return created;
}

// Only the fields the admin edit screen may change — deliberately narrower
// than OrderUpdateInput so this action can never touch status, assignments,
// the dress type (it picks the id series), or the image columns directly
// (those only move through the photo-slot handling below).
export interface OrderEditInput {
  customer?: string;
  phone?: string;
  material?: string;
  amount?: number;
  advance?: number;
  advanceMethod?: PaymentMethod | null;
  due?: string;
  measurements?: GarmentMeasurements;
  lineItems?: OrderLineItem[];
  notes?: string;
  // How many garments the order is for. Sent as a count, not an array: the
  // server reconciles it against what's already there so a client can never
  // remove a garment that's with the customer or re-point a payment at a new
  // one. Handled separately from EDITABLE_FIELDS below since it maps to
  // `pieces`, not to a column of its own.
  pieceCount?: number;
}

const EDITABLE_FIELDS = [
  "customer", "phone", "material", "amount", "advance", "advanceMethod", "due",
  "measurements", "lineItems", "notes",
] as const;

async function deletePhotoSlots(orderId: string, slotPrefix: string, from: number, to: number) {
  await Promise.all(
    Array.from({ length: to - from + 1 }, (_, i) =>
      getImageStorage().delete(`orders/${orderId}/${slotPrefix}-${from + i}.jpg`)
    )
  );
}

// Partial edit: only the fields the admin actually changed arrive in `patch`,
// and only the photo galleries that changed arrive in `photos` (flagged with
// "sketchChanged"/"referenceChanged"/"materialChanged" = "1"). A changed
// gallery is sent in full and rewrites its fixed slots: new files overwrite
// slots 1..n (upload is upsert), then leftover higher slots are deleted —
// upload-before-delete so a failed upload can't lose the existing photos.
export async function updateOrder(id: string, patch: OrderEditInput, photos?: FormData): Promise<Order> {
  await requireRole(["admin"]);
  const current = await getDb().orders.findById(id);
  if (!current) throw new Error("Order not found.");
  if (current.status === "delivered" || current.status === "cancelled") {
    throw new Error("Delivered or cancelled orders can no longer be edited.");
  }

  const dbPatch: OrderUpdateInput = {};
  for (const field of EDITABLE_FIELDS) {
    if (patch[field] !== undefined) {
      (dbPatch as Record<string, unknown>)[field] = patch[field];
    }
  }
  if (dbPatch.due !== undefined && !dbPatch.due) {
    throw new Error("Delivery date is required.");
  }
  if (patch.pieceCount !== undefined) {
    const next = reconcilePieces(
      current.pieces,
      patch.pieceCount,
      current.dress,
      // A new garment follows whatever the order's delivery date now is,
      // including one being changed in this same edit.
      dbPatch.due ?? current.due
    );
    // Only write when it actually moves — an unchanged count shouldn't make
    // this a "real" edit or rewrite the stored array.
    if (JSON.stringify(next) !== JSON.stringify(current.pieces)) {
      dbPatch.pieces = next;
    }
  }
  for (const money of ["amount", "advance"] as const) {
    const value = dbPatch[money];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`Enter a valid ${money === "amount" ? "total" : "advance"} amount.`);
    }
  }

  if (photos?.get("sketchChanged") === "1") {
    const stored = await storeSketch(id, photos);
    if (!stored) await getImageStorage().delete(`orders/${id}/sketch.png`);
    dbPatch.sketchDataUrl = stored;
  }
  if (photos?.get("referenceChanged") === "1") {
    const files = filesFrom(photos, "reference", MAX_REFERENCE_IMAGES);
    dbPatch.referenceImageUrls = await storePhotos(id, files, "reference");
    await deletePhotoSlots(id, "reference", files.length + 1, MAX_REFERENCE_IMAGES);
  }
  if (photos?.get("materialChanged") === "1") {
    const files = filesFrom(photos, "material", MAX_MATERIAL_IMAGES);
    if (files.length === 0) {
      throw new Error("At least one material photo is required.");
    }
    dbPatch.materialImageUrls = await storePhotos(id, files, "material");
    await deletePhotoSlots(id, "material", files.length + 1, MAX_MATERIAL_IMAGES);
  }

  if (Object.keys(dbPatch).length === 0) return current;

  const updated = await getDb().orders.update(id, dbPatch);
  revalidateOrderPaths(id);
  refresh();
  return updated;
}

// Assigning a master starts the cutting stage — no separate "save
// assignment" step. Only auto-advances "new" -> "cutting"; reassigning a
// master later (order already past "new") just updates who's assigned.
export async function assignMaster(id: string, masterId: string | null): Promise<Order> {
  await requireRole(["admin"]);
  const current = await getDb().orders.findById(id);
  if (!current) throw new Error("Order not found.");

  const patch: OrderUpdateInput = { masterId };
  if (masterId && current.status === "new") patch.status = "cutting";

  const updated = await getDb().orders.update(id, patch);
  revalidateOrderPaths(id);
  refresh();
  return updated;
}

// Assigning a tailor once cutting is done starts stitching — same
// no-separate-save-step pattern as assignMaster above.
export async function assignTailor(id: string, tailorId: string | null): Promise<Order> {
  await requireRole(["admin"]);
  const current = await getDb().orders.findById(id);
  if (!current) throw new Error("Order not found.");

  const patch: OrderUpdateInput = { tailorId };
  if (tailorId && current.status === "cutting_done") patch.status = "stitching";

  const updated = await getDb().orders.update(id, patch);
  revalidateOrderPaths(id);
  refresh();
  return updated;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  await requireRole([...ALL_ROLES]);
  // Delivering has to collect the balance, so it can only go through
  // deliverOrder below. Refusing here means no caller — master, tailor, or a
  // future screen — can hand an order over without recording the payment.
  if (status === "delivered") {
    throw new Error("Use deliverOrder to mark an order delivered — it must record the payment.");
  }
  // Same rule, for the same reason: "partly delivered" is a statement about
  // which garments have physically left the shop, derived from the pieces
  // themselves. Only deliverPiece may write it.
  if (status === "partly_delivered") {
    throw new Error("Use deliverPiece to hand a piece over — it records which piece left.");
  }
  const updated = await getDb().orders.updateStatus(id, status);
  revalidateOrderPaths(id);
  refresh();
  return updated;
}

// Hands the order over and settles it in one step. The balance is computed
// server-side from the stored order rather than taken from the client, so the
// amount recorded is always exactly what was owed.
export async function deliverOrder(id: string, method: PaymentMethod): Promise<Order> {
  await requireRole(["admin"]);
  if (method !== "cash" && method !== "upi") {
    throw new Error("Choose how the payment was made.");
  }
  const order = await getDb().orders.findById(id);
  if (!order) throw new Error("Order not found.");
  if (order.status === "cancelled") {
    throw new Error("A cancelled order can't be delivered.");
  }

  const balance = orderBalance(order);
  const updated = await getDb().orders.updateStatus(id, "delivered", {
    ...collectPayment(order, balance, method, null),
    // Handing the whole order over hands over everything still in the shop.
    // A single-garment order has no pieces and this is a no-op.
    ...(order.pieces ? { pieces: markPiecesDelivered(order.pieces) } : {}),
  });
  revalidateOrderPaths(id);
  refresh();
  return updated;
}

// ── Multi-piece delivery ────────────────────────────────────────────────

// The patch fragment that records money arriving after placement. Keeps the
// two-entry model authoritative — finalPayment stays the running total and
// finalPaymentMethod the latest method — and adds the ledger entry that says
// which hand-over it came with. A zero collection records nothing at all: an
// order paid in full up front must not claim its balance arrived as cash.
function collectPayment(
  order: Order,
  amount: number,
  method: PaymentMethod,
  pieceId: string | null
): OrderUpdateInput {
  if (amount <= 0) return {};
  const entry: OrderPayment = {
    id: crypto.randomUUID(),
    amount,
    method,
    at: new Date().toISOString(),
    pieceId,
  };
  return {
    finalPayment: order.finalPayment + amount,
    finalPaymentMethod: method,
    payments: [...order.payments, entry],
  };
}

function markPiecesDelivered(pieces: OrderPiece[]): OrderPiece[] {
  const at = new Date().toISOString();
  return pieces.map((p) =>
    p.status === "delivered" ? p : { ...p, status: "delivered" as const, deliveredAt: at }
  );
}

// Hands ONE garment of a multi-piece order over.
//
// Deliberately not gated on how far along the order is. With staggered dates
// the first blouse goes out while the third is still being stitched, and this
// shop doesn't use the master/tailor assignment at all — its orders sit at
// "new" for their whole life. An earlier version refused to hand a piece over
// from "new", which made the feature unusable here: the admin got a 500 whose
// message Next.js had already replaced with a digest, so it surfaced as
// "check your connection".
//
// The only states that block are the two where handing a garment over is
// meaningless: cancelled, and already fully delivered.
//
// The last pending piece is the whole order being handed over, so it settles
// exactly like deliverOrder: the full remaining balance, computed server-side.
// Earlier pieces may collect any part of the balance, or nothing at all.
export async function deliverPiece(
  id: string,
  pieceId: string,
  collect?: { amount: number; method: PaymentMethod }
): Promise<Order> {
  await requireRole(["admin"]);
  const order = await getDb().orders.findById(id);
  if (!order) throw new Error("Order not found.");
  if (order.status === "cancelled") throw new Error("A cancelled order can't be delivered.");
  if (order.status === "delivered") throw new Error("This order has already been handed over in full.");
  if (!order.pieces?.length) throw new Error("This order isn't split into pieces.");

  const piece = order.pieces.find((p) => p.id === pieceId);
  if (!piece) throw new Error("That piece isn't part of this order.");
  if (piece.status === "delivered") throw new Error(`${piece.label} has already been handed over.`);

  const balance = orderBalance(order);
  const isLast = order.pieces.filter((p) => p.status === "pending").length === 1;

  // The final hand-over settles the order, so the amount isn't the admin's to
  // choose — it is exactly what's owed, same rule as deliverOrder.
  let amount = isLast ? balance : (collect?.amount ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Enter a valid amount to collect.");
  }
  amount = Math.min(Math.round(amount * 100) / 100, balance);
  const method = collect?.method ?? "cash";
  if (amount > 0 && method !== "cash" && method !== "upi") {
    throw new Error("Choose how the payment was made.");
  }

  const at = new Date().toISOString();
  const pieces = order.pieces.map((p) =>
    p.id === pieceId ? { ...p, status: "delivered" as const, deliveredAt: at } : p
  );

  const updated = await getDb().orders.updateStatus(id, isLast ? "delivered" : "partly_delivered", {
    ...collectPayment(order, amount, method, pieceId),
    pieces,
  });
  revalidateOrderPaths(id);
  refresh();
  return updated;
}

// Delivery dates get pushed — the shop's own terms say so. Only a piece that
// is still pending can move; a date on a garment already with the customer is
// history, not a plan.
export async function updatePieceDue(id: string, pieceId: string, due: string): Promise<Order> {
  await requireRole(["admin"]);
  if (!due) throw new Error("Delivery date is required.");
  const order = await getDb().orders.findById(id);
  if (!order) throw new Error("Order not found.");
  if (!order.pieces?.length) throw new Error("This order isn't split into pieces.");

  const piece = order.pieces.find((p) => p.id === pieceId);
  if (!piece) throw new Error("That piece isn't part of this order.");
  if (piece.status === "delivered") throw new Error("That piece has already been handed over.");

  const pieces = order.pieces.map((p) => (p.id === pieceId ? { ...p, due } : p));
  const updated = await getDb().orders.update(id, { pieces });
  revalidateOrderPaths(id);
  refresh();
  return updated;
}

// ── Alterations ─────────────────────────────────────────────────────────
//
// An alteration never touches order.status: the order was delivered and stays
// delivered, so revenue, the delivered count and every Reports figure are
// untouched by a garment coming back. What changes is the badge the admin
// reads, derived from these records by orderDisplayStatus().

export interface StartAlterationInput {
  reason: string;
  promisedAt: string;
  // Which garment came back, on a multi-piece order. Stored as the label so
  // the record still reads correctly if the piece is later renamed.
  pieceLabel?: string | null;
}

export async function startAlteration(id: string, input: StartAlterationInput): Promise<Order> {
  await requireRole(["admin"]);
  assertAlterationsEnabled();
  if (!input.promisedAt) throw new Error("Set the date the alteration is promised for.");

  const order = await getDb().orders.findById(id);
  if (!order) throw new Error("Order not found.");
  if (order.status !== "delivered") {
    throw new Error("Only a delivered order can come back for an alteration.");
  }
  if (openAlteration(order)) {
    throw new Error("This order is already in alteration — finish that one first.");
  }

  const record: AlterationRecord = {
    id: crypto.randomUUID(),
    reason: input.reason.trim(),
    pieceLabel: input.pieceLabel?.trim() || null,
    receivedAt: shopToday(),
    promisedAt: input.promisedAt,
    completedAt: null,
    redeliveredAt: null,
  };

  const updated = await getDb().orders.update(id, { alterations: [...order.alterations, record] });
  revalidateOrderPaths(id);
  refresh();
  return updated;
}

// Alteration work finished — the garment is back on the shelf waiting for the
// customer, not yet handed over.
export async function completeAlteration(id: string): Promise<Order> {
  await requireRole(["admin"]);
  const order = await getDb().orders.findById(id);
  if (!order) throw new Error("Order not found.");

  const open = openAlteration(order);
  if (!open) throw new Error("This order isn't in alteration.");
  if (open.completedAt) throw new Error("That alteration is already done.");

  const alterations = order.alterations.map((a) =>
    a.id === open.id ? { ...a, completedAt: shopToday() } : a
  );
  const updated = await getDb().orders.update(id, { alterations });
  revalidateOrderPaths(id);
  refresh();
  return updated;
}

// Handed back to the customer — closes the record, and the order reads as a
// plain delivered order again with the episode kept in its history.
export async function redeliverAlteration(id: string): Promise<Order> {
  await requireRole(["admin"]);
  const order = await getDb().orders.findById(id);
  if (!order) throw new Error("Order not found.");

  const open = openAlteration(order);
  if (!open) throw new Error("This order isn't in alteration.");
  if (!open.completedAt) throw new Error("Mark the alteration done before handing it back.");

  const alterations = order.alterations.map((a) =>
    a.id === open.id ? { ...a, redeliveredAt: shopToday() } : a
  );
  const updated = await getDb().orders.update(id, { alterations });
  revalidateOrderPaths(id);
  refresh();
  return updated;
}

// Cancellation charge replaces the order's amount as what's actually owed —
// the original amount is kept (and struck through in the UI) for the record.
export async function cancelOrder(id: string, cancellationCharge: number): Promise<Order> {
  await requireRole(["admin"]);
  if (!Number.isFinite(cancellationCharge) || cancellationCharge < 0) {
    throw new Error("Enter a valid cancellation charge.");
  }
  const updated = await getDb().orders.updateStatus(id, "cancelled", { cancellationCharge });
  revalidateOrderPaths(id);
  refresh();
  return updated;
}

export async function deleteOrder(id: string): Promise<void> {
  await requireRole(["admin"]);
  await getDb().orders.delete(id);
  // Best-effort: paths are predictable, deleting a non-existent one is a harmless no-op.
  const referenceDeletes = Array.from({ length: MAX_REFERENCE_IMAGES }, (_, i) =>
    getImageStorage().delete(`orders/${id}/reference-${i + 1}.jpg`)
  );
  const materialDeletes = Array.from({ length: MAX_MATERIAL_IMAGES }, (_, i) =>
    getImageStorage().delete(`orders/${id}/material-${i + 1}.jpg`)
  );
  await Promise.all([
    getImageStorage().delete(`orders/${id}/sketch.png`),
    ...referenceDeletes,
    ...materialDeletes,
  ]);
  revalidateOrderPaths(id);
  refresh();
}
