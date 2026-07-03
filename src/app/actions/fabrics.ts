"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { getDb, type Fabric, type FabricWriteInput } from "@/lib/db";

// Fabrics are only read and managed inside the admin-only new-order wizard.
// Mutations return result objects instead of throwing — Next.js masks thrown
// Server Action error messages in production, and the manager UI needs to
// show specifics like "name already exists".

export interface FabricResult {
  fabric?: Fabric;
  error?: string;
}

function validationError(input: Partial<FabricWriteInput>): string | null {
  if (input.name !== undefined && !input.name.trim()) {
    return "Enter a fabric name.";
  }
  if (input.price !== undefined && (!Number.isFinite(input.price) || input.price < 0)) {
    return "Enter a valid price per metre.";
  }
  return null;
}

// The `fabrics.name` column is unique — surface that as a readable message
// instead of the raw Postgres constraint error.
function toErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("duplicate key")) {
    return "A fabric with this name already exists.";
  }
  return fallback;
}

export async function getFabrics(): Promise<Fabric[]> {
  await requireRole(["admin"]);
  return getDb().fabrics.list();
}

export async function createFabric(input: FabricWriteInput): Promise<FabricResult> {
  await requireRole(["admin"]);
  const invalid = validationError(input);
  if (invalid) return { error: invalid };
  try {
    const fabric = await getDb().fabrics.create({ name: input.name.trim(), price: input.price });
    revalidatePath("/admin/orders/new");
    return { fabric };
  } catch (error) {
    return { error: toErrorMessage(error, "Couldn't add the fabric. Check your connection and try again.") };
  }
}

export async function updateFabric(id: string, patch: Partial<FabricWriteInput>): Promise<FabricResult> {
  await requireRole(["admin"]);
  const invalid = validationError(patch);
  if (invalid) return { error: invalid };
  try {
    const fabric = await getDb().fabrics.update(id, {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.price !== undefined ? { price: patch.price } : {}),
    });
    revalidatePath("/admin/orders/new");
    return { fabric };
  } catch (error) {
    return { error: toErrorMessage(error, "Couldn't save the fabric. Check your connection and try again.") };
  }
}

export async function deleteFabric(id: string): Promise<{ error?: string }> {
  await requireRole(["admin"]);
  try {
    await getDb().fabrics.delete(id);
    revalidatePath("/admin/orders/new");
    return {};
  } catch {
    return { error: "Couldn't delete the fabric. Check your connection and try again." };
  }
}
