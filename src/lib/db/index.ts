import type { Database } from "./types";
import { createSupabaseStaffRepository } from "./supabase/staffRepository";
import { createSupabaseOrderRepository } from "./supabase/orderRepository";

export * from "./types";

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    db = {
      staff: createSupabaseStaffRepository(),
      orders: createSupabaseOrderRepository(),
    };
  }
  return db;
}

export function resetDbForTests(): void {
  db = null;
}
