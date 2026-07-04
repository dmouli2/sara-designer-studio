"use server";

import { revalidatePath, refresh } from "next/cache";
import { requireRole } from "@/lib/dal";
import { getDb, type OrderWriteInput, type OrderUpdateInput, type OrderListFilter } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";
import { MAX_REFERENCE_IMAGES, MAX_MATERIAL_IMAGES, type Order, type OrderStatus } from "@/types";

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
