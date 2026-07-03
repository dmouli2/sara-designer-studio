import { getSupabaseClient } from "../../supabase/client";
import type { FabricRepository, Fabric, FabricWriteInput } from "../types";

interface FabricRow {
  id: string;
  name: string;
  price: number;
  created_at: string;
}

function toFabric(row: FabricRow): Fabric {
  return { id: row.id, name: row.name, price: Number(row.price) };
}

export function createSupabaseFabricRepository(): FabricRepository {
  return {
    async list() {
      const { data, error } = await getSupabaseClient()
        .from("fabrics")
        .select("id, name, price, created_at")
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return ((data ?? []) as FabricRow[]).map(toFabric);
    },

    async create(input: FabricWriteInput) {
      const { data, error } = await getSupabaseClient()
        .from("fabrics")
        .insert({ name: input.name, price: input.price })
        .select("id, name, price, created_at")
        .single();
      if (error) throw new Error(error.message);
      return toFabric(data as FabricRow);
    },

    async update(id: string, patch: Partial<FabricWriteInput>) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.price !== undefined) row.price = patch.price;

      const { data, error } = await getSupabaseClient()
        .from("fabrics")
        .update(row)
        .eq("id", id)
        .select("id, name, price, created_at")
        .single();
      if (error) throw new Error(error.message);
      return toFabric(data as FabricRow);
    },

    async delete(id: string) {
      const { error } = await getSupabaseClient().from("fabrics").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
