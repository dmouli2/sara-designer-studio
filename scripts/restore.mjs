// Restores a folder made by scripts/backup.mjs back into Supabase.
//
//   npm run restore -- backups/2026-09-02_1830            (dry run — shows what it would do)
//   npm run restore -- backups/2026-09-02_1830 --confirm  (actually writes)
//
// Rows are upserted by primary key and photos are uploaded with upsert, so a
// restore REPLACES anything currently in the database that shares an id with
// the backup. Rows created after the backup was taken are left alone rather
// than deleted — this puts the copy back, it does not rewind the project.
//
// The dry run is the default deliberately: the one time you reach for this
// script is a bad day, and a bad day is when destructive commands get typed
// against the wrong project.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  BUCKET,
  TABLES,
  formatBytes,
  loadEnvLocal,
  serviceClient,
} from "./lib/backup-common.mjs";

const CONTENT_TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

async function main() {
  const dir = process.argv[2];
  const confirmed = process.argv.includes("--confirm");

  if (!dir) {
    console.error("Usage: npm run restore -- backups/<folder> [--confirm]");
    process.exit(1);
  }
  if (!existsSync(join(dir, "manifest.json"))) {
    console.error(`${dir} doesn't look like a backup — no manifest.json in it.`);
    process.exit(1);
  }

  loadEnvLocal();
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));

  console.log(`Backup taken ${manifest.takenAt}`);
  console.log(`  from  ${manifest.supabaseUrl}`);
  console.log(`  into  ${process.env.SUPABASE_URL}`);
  if (manifest.supabaseUrl !== process.env.SUPABASE_URL) {
    // Not refused — restoring into a fresh project is a legitimate reason to
    // be here — but it should never happen by accident.
    console.log("  ⚠  different project than the one this was taken from");
  }

  const storageDir = join(dir, "storage");
  const photos = existsSync(storageDir) ? walk(storageDir) : [];
  const tables = TABLES.map((t) => ({
    table: t,
    rows: JSON.parse(readFileSync(join(dir, "tables", `${t}.json`), "utf8")),
  }));

  console.log("");
  for (const { table, rows } of tables) console.log(`  ${table.padEnd(13)} ${String(rows.length).padStart(5)} rows`);
  console.log(`  ${"photos".padEnd(13)} ${String(photos.length).padStart(5)} files`);

  if (!confirmed) {
    console.log("\nDry run — nothing was written. Add --confirm to restore for real.");
    return;
  }

  console.log("\nRestoring…");
  // TABLES is already in foreign-key order: staff and fabrics before the
  // orders that reference them.
  for (const { table, rows } of tables) {
    if (rows.length === 0) continue;
    const { error } = await serviceClient().from(table).upsert(rows, { onConflict: "id" });
    if (error) throw new Error(`Restoring ${table}: ${error.message}`);
    console.log(`  ${table}: ${rows.length} rows`);
  }

  let bytes = 0;
  for (const file of photos) {
    // backups/<stamp>/storage/orders/B2530/material-1.jpg → orders/B2530/material-1.jpg
    const path = file.slice(storageDir.length + 1).split(/[\\/]/).join("/");
    const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
    const body = readFileSync(file);
    const { error } = await serviceClient()
      .storage.from(BUCKET)
      .upload(path, body, { contentType: CONTENT_TYPES[ext] ?? "application/octet-stream", upsert: true });
    if (error) {
      console.warn(`  ! ${path}: ${error.message}`);
      continue;
    }
    bytes += body.length;
  }
  console.log(`  photos: ${formatBytes(bytes)}`);

  // Sequences are not table data and no upsert can carry them — without this
  // the next order placed would be handed an id that already exists.
  if (manifest.sequenceResets?.length) {
    console.log("\nOne last step — run this in the Supabase SQL editor so the next");
    console.log("order id follows on from the restored ones:\n");
    for (const sql of manifest.sequenceResets) console.log(`  ${sql}`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(`\nRestore failed: ${err.message}`);
  process.exit(1);
});
