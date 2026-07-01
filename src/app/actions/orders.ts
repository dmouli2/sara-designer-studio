"use server";

import { revalidatePath, refresh } from "next/cache";
import { requireRole } from "@/lib/dal";
import { getDb, type OrderWriteInput } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";
import type { Order, OrderStatus } from "@/types";

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
async function storeImage(
  orderId: string,
  kind: "sketch" | "reference",
  value: string | null
): Promise<string | null> {
  if (!isDataUrl(value)) return value ?? null;
  const extension = kind === "sketch" ? "png" : "jpg";
  const path = `orders/${orderId}/${kind}.${extension}`;
  await getImageStorage().upload(path, value);
  return path;
}

export async function getOrders(): Promise<Order[]> {
  await requireRole([...ALL_ROLES]);
  return getDb().orders.list();
}

export async function getOrder(id: string): Promise<Order | null> {
  await requireRole([...ALL_ROLES]);
  return getDb().orders.findById(id);
}

export async function createOrder(input: OrderWriteInput): Promise<Order> {
  await requireRole(["admin"]);
  if (!input.due) {
    throw new Error("Delivery date is required.");
  }

  const [sketchDataUrl, referenceImageUrl] = await Promise.all([
    storeImage(input.id, "sketch", input.sketchDataUrl),
    storeImage(input.id, "reference", input.referenceImageUrl),
  ]);

  const created = await getDb().orders.create({ ...input, sketchDataUrl, referenceImageUrl });
  revalidatePath("/admin/orders");
  return created;
}

export async function assignStaff(
  id: string,
  masterId: string | null,
  tailorId: string | null
): Promise<Order> {
  await requireRole(["admin"]);
  const updated = await getDb().orders.update(id, { masterId, tailorId });
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

export async function deleteOrder(id: string): Promise<void> {
  await requireRole(["admin"]);
  await getDb().orders.delete(id);
  // Best-effort: paths are predictable, deleting a non-existent one is a harmless no-op.
  await Promise.all([
    getImageStorage().delete(`orders/${id}/sketch.png`),
    getImageStorage().delete(`orders/${id}/reference.jpg`),
  ]);
  revalidateOrderPaths(id);
}
