import { getDb } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";

// Daily cron (vercel.json): frees Supabase Storage by deleting sketch and
// reference images of orders that were delivered/cancelled more than
// RETENTION_DAYS ago, then blanking the image columns. Keeps the 1 GB
// free-tier storage effectively bottomless at this shop's volume.
export const dynamic = "force-dynamic";

const RETENTION_DAYS = 90;

function isStoragePath(value: string): boolean {
  // Pre-Storage-migration rows held base64 data URLs in these columns — those
  // have no storage object to delete, but blanking the column still frees DB
  // space.
  return !value.startsWith("data:");
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const candidates = await getDb().orders.listImageCleanupCandidates(cutoff);

  for (const order of candidates) {
    const paths = [order.sketchDataUrl, ...order.referenceImageUrls, ...order.materialImageUrls].filter(
      (p): p is string => !!p && isStoragePath(p)
    );
    await Promise.all(paths.map((path) => getImageStorage().delete(path)));
    await getDb().orders.update(order.id, {
      sketchDataUrl: null,
      referenceImageUrls: [],
      materialImageUrls: [],
    });
  }

  return Response.json({ cleaned: candidates.length });
}
