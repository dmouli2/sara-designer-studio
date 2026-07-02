"use server";

import { getDb, type PublicOrder } from "@/lib/db";

// Deliberately unauthenticated — backs the public order-tracking page
// (src/app/track/[token]/) that customers open from the WhatsApp share
// link, with no login. Do not add role checks here, and do not call
// getDb().orders.findById()/list() from a public surface: those resolve
// master/tailor identities that must never reach an unauthenticated visitor.
export async function getPublicOrder(token: string): Promise<PublicOrder | null> {
  return getDb().orders.findByPublicToken(token);
}
