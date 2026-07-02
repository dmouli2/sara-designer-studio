"use server";

import { revalidatePath, refresh } from "next/cache";
import { requireRole } from "@/lib/dal";
import { getDb, type OrderWriteInput, type OrderUpdateInput } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";
import { MAX_REFERENCE_IMAGES, type Order, type OrderStatus } from "@/types";

const ALL_ROLES = ["admin", "master", "tailor"] as const;

function revalidateOrderPaths(id: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/master/orders/${id}`);
  revalidatePath(`/tailor/orders/${id}`);
  revalidatePath("/master/queue");
  revalidatePath("/tailor/queue");
}

function isDataUrl(value: string | null | undefined): value is string {
  return !!value && value.startsWith("data:");
}

// The wizard still sends a base64 data URL; this uploads it to Storage and
// swaps it for the storage path before it ever reaches the `orders` table.
async function storeSketch(orderId: string, value: string | null): Promise<string | null> {
  if (!isDataUrl(value)) return value ?? null;
  const path = `orders/${orderId}/sketch.png`;
  await getImageStorage().upload(path, value);
  return path;
}

// Reference photos upload to fixed, predictable slots (reference-1..8.jpg) so
// deleteOrder can clean them up without needing to know how many were used.
async function storeReferenceImages(orderId: string, values: string[]): Promise<string[]> {
  const paths = await Promise.all(
    values.slice(0, MAX_REFERENCE_IMAGES).map(async (value, i) => {
      if (!isDataUrl(value)) return value || null;
      const path = `orders/${orderId}/reference-${i + 1}.jpg`;
      await getImageStorage().upload(path, value);
      return path;
    })
  );
  return paths.filter((p): p is string => !!p);
}

export async function getOrders(): Promise<Order[]> {
  await requireRole([...ALL_ROLES]);
  return getDb().orders.list();
}

export async function getOrder(id: string): Promise<Order | null> {
  await requireRole([...ALL_ROLES]);
  return getDb().orders.findById(id);
}

export async function createOrder(
  input: Omit<OrderWriteInput, "id" | "cancellationCharge">
): Promise<Order & { publicToken: string }> {
  await requireRole(["admin"]);
  if (!input.due) {
    throw new Error("Delivery date is required.");
  }

  // Reserved once per order, from the dress-category's own DB sequence —
  // never generated client-side. See supabase/migrations/0003_order_id_sequences.sql.
  const id = await getDb().orders.nextOrderId(input.dress);

  const [sketchDataUrl, referenceImageUrls] = await Promise.all([
    storeSketch(id, input.sketchDataUrl),
    storeReferenceImages(id, input.referenceImageUrls),
  ]);

  // cancellationCharge only ever exists once an order is cancelled — see
  // cancelOrder below — never something a new order carries in.
  const created = await getDb().orders.create({
    ...input,
    id,
    sketchDataUrl,
    referenceImageUrls,
    cancellationCharge: null,
  });
  revalidatePath("/admin/orders");
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
  await Promise.all([getImageStorage().delete(`orders/${id}/sketch.png`), ...referenceDeletes]);
  revalidateOrderPaths(id);
}
