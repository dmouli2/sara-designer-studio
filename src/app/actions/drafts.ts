"use server";

import { revalidatePath, refresh } from "next/cache";
import { requireRole } from "@/lib/dal";
import { getDb, type DraftOrder } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";
import { getSlipExtractor } from "@/lib/extraction";
import { normalizeExtraction } from "@/lib/extraction/normalize";
import { assertScanFeatureEnabled } from "@/lib/features";

// Scan-to-draft-order actions. Admin-only, and every one of them refuses
// when the FEATURE_SCAN_ORDERS kill switch is off. Drafts never touch the
// order-id sequences — a draft becomes a real order only when the admin
// confirms it through the wizard, which submits via the normal createOrder
// action (that's where the S…/B… id is reserved).

// A draft's scan photo lives at a fixed slot, mirroring the orders/{id}/…
// convention in orders.ts.
function scanPathFor(draftId: string): string {
  return `drafts/${draftId}/scan-1.jpg`;
}

// Same transport rule as createOrder: the photo rides as a multipart File
// in FormData, never as a base64 string inside the action arguments.
async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type || "image/jpeg"};base64,${buffer.toString("base64")}`;
}

export interface DraftWithScanUrl extends DraftOrder {
  scanImageUrl: string | null;
}

export async function createDraftFromScan(photos: FormData): Promise<{ id: string }> {
  await requireRole(["admin"]);
  assertScanFeatureEnabled();

  const scan = photos.get("scan");
  if (!(scan instanceof File)) {
    throw new Error("No scan photo received — capture the order slip and try again.");
  }
  const scanDataUrl = await fileToDataUrl(scan);

  // Read the slip first: extraction has no side effects, so a model failure
  // leaves nothing to clean up and the admin can retry with the same photo.
  const extraction = await getSlipExtractor().extract(scanDataUrl);
  if (extraction.imageProblem === "not_a_slip") {
    throw new Error("This doesn't look like an order-book slip — photograph the full book page and try again.");
  }
  if (extraction.imageProblem === "unreadable") {
    throw new Error("The photo is too blurry or dark to read — retake it with better light and the page flat.");
  }
  const { prefill, warnings } = normalizeExtraction(extraction);

  // The id is minted here (not by Postgres) so the storage path can embed
  // it before the row exists: upload first, insert second, and a failed
  // insert cleans up its orphaned photo.
  const draftId = crypto.randomUUID();
  const scanImagePath = scanPathFor(draftId);
  await getImageStorage().upload(scanImagePath, scanDataUrl);
  try {
    await getDb().drafts.create({
      id: draftId,
      dress: prefill.dress ?? "",
      scanImagePath,
      extraction,
      warnings,
    });
  } catch (err) {
    await getImageStorage().delete(scanImagePath).catch(() => {});
    throw err;
  }

  revalidatePath("/admin/drafts");
  refresh();
  return { id: draftId };
}

export async function getDrafts(): Promise<DraftOrder[]> {
  await requireRole(["admin"]);
  assertScanFeatureEnabled();
  return getDb().drafts.list();
}

export async function getDraft(id: string): Promise<DraftWithScanUrl | null> {
  await requireRole(["admin"]);
  assertScanFeatureEnabled();
  const draft = await getDb().drafts.findById(id);
  if (!draft) return null;
  const scanImageUrl = draft.scanImagePath
    ? await getImageStorage().getSignedUrl(draft.scanImagePath)
    : null;
  return { ...draft, scanImageUrl };
}

// Discard deletes the draft outright (row + scan photo) — drafts are queue
// items, not records; the book page itself remains the record.
export async function discardDraft(id: string): Promise<void> {
  await requireRole(["admin"]);
  assertScanFeatureEnabled();
  await getDb().drafts.delete(id);
  // Best-effort: deleting a non-existent object is a harmless no-op.
  await getImageStorage().delete(scanPathFor(id));
  revalidatePath("/admin/drafts");
  refresh();
}

// Called by the wizard right after createOrder succeeds. The scan photo has
// been re-uploaded into the order's reference gallery by then, so the
// drafts/ copy is deleted to keep storage lean.
export async function confirmDraft(id: string, orderId: string): Promise<void> {
  await requireRole(["admin"]);
  assertScanFeatureEnabled();
  if (!orderId) throw new Error("Order id is required to confirm a draft.");
  await getDb().drafts.updateStatus(id, "confirmed", orderId);
  await getImageStorage().delete(scanPathFor(id));
  revalidatePath("/admin/drafts");
  refresh();
}
