import { getDb } from "@/lib/db";

// Touches the database so the daily cron ping (vercel.json) counts as
// Supabase API activity — free-tier projects are paused after 7 days without
// any, e.g. when the shop closes for a festival week. Also usable by an
// external uptime pinger to keep the Vercel function warm.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().staff.list({ activeOnly: true });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
