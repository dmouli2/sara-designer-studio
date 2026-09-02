// Shared plumbing for the weekly backup and its restore.
//
// Supabase's Free plan takes NO automatic backups — their own docs tell free
// projects to export their data themselves and keep it off-site. These two
// scripts are that export. They deliberately use nothing but the credentials
// already in .env.local (SUPABASE_URL + service-role key), so a backup needs
// no CLI login, no database password, and no new account to lose access to.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

export const BUCKET = "order-images";

// Written and restored in this order: staff and fabrics first because orders
// reference staff through master_id/tailor_id, so restoring orders first
// would fail the foreign key.
//
// `login_attempts` is deliberately absent. It holds the failed-login counter
// backing the rate limit — transient state that is meaningless an hour later,
// and restoring it would re-apply lockouts nobody is serving any more.
export const TABLES = ["staff", "fabrics", "orders", "draft_orders"];

// A plain node script gets none of Next.js's env loading, and adding dotenv
// for four lines of parsing isn't worth a dependency.
export function loadEnvLocal(path = ".env.local") {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(
      `Couldn't read ${path}. Run this from the project root, with the same env file the dev server uses.`
    );
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip one layer of matching quotes, the way dotenv does.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Never clobber something already exported in the shell.
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  // The service-role key bypasses RLS, which is the whole point here: a
  // backup has to see every row, not the rows one signed-in member of staff
  // is allowed to see.
  return createClient(url, key, { auth: { persistSession: false } });
}

// PostgREST caps a response at 1000 rows whatever you ask for, so every read
// pages. The shop is nowhere near that today; a backup that silently stopped
// at row 1000 in two years' time is exactly the kind of thing you only find
// out about on the day you need it.
const PAGE = 500;

export async function fetchAllRows(db, table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw new Error(`Reading ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

// Storage's list() is per-prefix and non-recursive, and the bucket nests two
// deep (orders/<id>/material-1.jpg). Walk it rather than deriving paths from
// the order rows, so a file nothing points at any more is still backed up —
// a backup's job is to copy what is there, not what should be there.
export async function listAllFiles(db, prefix = "") {
  const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw new Error(`Listing ${prefix || "/"}: ${error.message}`);

  const files = [];
  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    // A folder comes back with no id/metadata; a real object always has both.
    if (entry.id === null || entry.id === undefined) {
      files.push(...(await listAllFiles(db, path)));
    } else {
      files.push({ path, size: entry.metadata?.size ?? 0 });
    }
  }
  return files;
}

// Order ids come from Postgres sequences (S2131.., B2401..), and those live
// outside the table — restoring rows into a fresh project would leave the
// sequences at their start value and hand the next customer an id that is
// already taken. The numbers are recorded here and replayed as setval() by
// the restore, read from the ROWS rather than from the sequence itself:
// calling next_order_id() to look would burn a real order number.
export function sequenceResets(orders) {
  const highest = { salwar_order_seq: 0, blouse_order_seq: 0 };
  for (const row of orders) {
    const id = String(row.id ?? "");
    const seq = id.startsWith("S") ? "salwar_order_seq" : id.startsWith("B") ? "blouse_order_seq" : null;
    if (!seq) continue;
    const n = parseInt(id.slice(1), 10);
    if (Number.isFinite(n) && n > highest[seq]) highest[seq] = n;
  }
  return Object.entries(highest)
    .filter(([, n]) => n > 0)
    .map(([seq, n]) => `select setval('${seq}', ${n}, true);`);
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
