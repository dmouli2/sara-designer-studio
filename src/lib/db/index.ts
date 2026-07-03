import type { Database } from "./types";
import { createSupabaseStaffRepository } from "./supabase/staffRepository";
import { createSupabaseOrderRepository } from "./supabase/orderRepository";
import { createSupabaseFabricRepository } from "./supabase/fabricRepository";

export * from "./types";

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    db = {
      staff: createSupabaseStaffRepository(),
      orders: createSupabaseOrderRepository(),
      fabrics: createSupabaseFabricRepository(),
    };
  }
  return db;
}

export function resetDbForTests(): void {
  db = null;
}
