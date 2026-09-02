// Weekly off-site backup of the whole shop: every table as JSON, every order
// photo as its original file.
//
//   npm run backup
//
// Writes backups/<YYYY-MM-DD_HHmm>/ — which is gitignored, and must stay that
// way: this repository is PUBLIC, and the dump holds every customer's name,
// phone number, measurements and payment history. Copy the folder somewhere
// off this machine (Drive, a pen drive) — a backup sitting on the same laptop
// as nothing else is only half a backup.
//
// Restore with: npm run restore -- backups/<folder>

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  BUCKET,
  TABLES,
  fetchAllRows,
  formatBytes,
  listAllFiles,
  loadEnvLocal,
  sequenceResets,
  serviceClient,
} from "./lib/backup-common.mjs";

function stamp() {
  // Local time, not UTC: the folder name is read by a person deciding which
  // Sunday's copy they want.
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function main() {
  loadEnvLocal();
  const db = serviceClient();

  const dir = join("backups", stamp());
  mkdirSync(join(dir, "tables"), { recursive: true });

  console.log(`Backing up to ${dir}\n`);

  // ── Tables ────────────────────────────────────────────────────────────
  const counts = {};
  let orders = [];
  for (const table of TABLES) {
    const rows = await fetchAllRows(db, table);
    if (table === "orders") orders = rows;
    counts[table] = rows.length;
    writeFileSync(join(dir, "tables", `${table}.json`), JSON.stringify(rows, null, 2));
    console.log(`  ${table.padEnd(13)} ${String(rows.length).padStart(5)} rows`);
  }

  // ── Photos ────────────────────────────────────────────────────────────
  // Downloaded one at a time on purpose. This runs once a week against a free
  // plan with a 10 GB egress allowance; finishing thirty seconds sooner is
  // worth less than not hammering the quota that also serves the shop.
  const files = await listAllFiles(db);
  let bytes = 0;
  let failed = 0;
  console.log(`\n  ${files.length} photos`);

  for (const file of files) {
    const { data, error } = await db.storage.from(BUCKET).download(file.path);
    if (error || !data) {
      // One unreadable file must not cost you the other 116.
      console.warn(`  ! skipped ${file.path}: ${error?.message ?? "no data"}`);
      failed++;
      continue;
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    const target = join(dir, "storage", file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, buffer);
    bytes += buffer.length;
  }

  // ── Manifest ──────────────────────────────────────────────────────────
  const manifest = {
    takenAt: new Date().toISOString(),
    supabaseUrl: process.env.SUPABASE_URL,
    bucket: BUCKET,
    tables: counts,
    photos: { copied: files.length - failed, failed, bytes },
    // Replayed by the restore — see sequenceResets for why the order-id
    // sequences cannot be recovered from the rows alone.
    sequenceResets: sequenceResets(orders),
  };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`\nDone — ${formatBytes(bytes)} of photos${failed ? `, ${failed} skipped` : ""}.`);
  console.log(`Now copy ${dir} somewhere off this machine.`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`\nBackup failed: ${err.message}`);
  process.exit(1);
});
