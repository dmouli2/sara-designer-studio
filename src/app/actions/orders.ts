"use server";

import { revalidatePath, refresh } from "next/cache";
import { requireRole } from "@/lib/dal";
import { getDb, type OrderWriteInput, type OrderUpdateInput, type OrderListFilter } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";
import {
  MAX_REFERENCE_IMAGES,
  MAX_MATERIAL_IMAGES,
  type GarmentMeasurements,
  type Order,
  type OrderLineItem,
  type OrderStatus,
} from "@/types";

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

// `photos` carries the images as multipart Files under the fields "sketch"
// (at most one), "reference" and "material" (repeated) — see the transport
// note on fileToDataUrl above for why they must not ride inside `input`.
export async function createOrder(
  input: Omit<
    OrderWriteInput,
    "id" | "cancellationCharge" | "sketchDataUrl" | "referenceImageUrls" | "materialImageUrls"
  >,
  photos: FormData
): Promise<Order & { publicToken: string }> {
  await requireRole(["admin"]);
  if (!input.due) {
    throw new Error("Delivery date is required.");
  }
  const referenceFiles = filesFrom(photos, "reference", MAX_REFERENCE_IMAGES);
  const materialFiles = filesFrom(photos, "material", MAX_MATERIAL_IMAGES);
  if (materialFiles.length === 0) {
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
    ...input,
    id,
    sketchDataUrl,
    referenceImageUrls,
    materialImageUrls,
    cancellationCharge: null,
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
  due?: string;
  measurements?: GarmentMeasurements;
  lineItems?: OrderLineItem[];
  notes?: string;
}

const EDITABLE_FIELDS = [
  "customer", "phone", "material", "amount", "advance", "due",
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
  const updated = await getDb().orders.updateStatus(id, status);
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
