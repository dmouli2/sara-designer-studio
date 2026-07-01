// One-time backfill: orders with base64 images stored directly in the
// database get those images uploaded to the "order-images" Storage bucket,
// with the column value replaced by the storage path. Safe to re-run —
// already-migrated rows (paths, not data URLs) are skipped.
//
// Usage: node --env-file=.env.local scripts/backfill-order-images.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const [, contentType, base64] = match;
  return { buffer: Buffer.from(base64, "base64"), contentType };
}

async function migrateField(orderId, kind, value, extension) {
  if (!value || !value.startsWith("data:")) return value ?? null;

  const parsed = parseDataUrl(value);
  if (!parsed) {
    console.warn(`  Skipping ${kind} for ${orderId}: not a valid data URL`);
    return value;
  }

  const path = `orders/${orderId}/${kind}.${extension}`;
  const { error } = await supabase.storage
    .from("order-images")
    .upload(path, parsed.buffer, { contentType: parsed.contentType, upsert: true });

  if (error) {
    console.error(`  Failed to upload ${kind} for ${orderId}:`, error.message);
    return value; // leave the original value untouched on failure
  }

  console.log(`  Uploaded ${kind} for ${orderId} -> ${path} (${parsed.buffer.length} bytes)`);
  return path;
}

async function main() {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, sketch_data_url, reference_image_url");
  if (error) throw new Error(error.message);

  const candidates = orders.filter(
    (o) => o.sketch_data_url?.startsWith("data:") || o.reference_image_url?.startsWith("data:")
  );

  console.log(`Found ${candidates.length} order(s) with inline base64 images to migrate.`);

  for (const order of candidates) {
    console.log(`Migrating ${order.id}...`);
    const sketchPath = await migrateField(order.id, "sketch", order.sketch_data_url, "png");
    const referencePath = await migrateField(order.id, "reference", order.reference_image_url, "jpg");

    const { error: updateError } = await supabase
      .from("orders")
      .update({ sketch_data_url: sketchPath, reference_image_url: referencePath })
      .eq("id", order.id);

    if (updateError) {
      console.error(`  Failed to update row for ${order.id}:`, updateError.message);
    } else {
      console.log(`  Row updated for ${order.id}.`);
    }
  }

  console.log("Backfill complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
