import { getSupabaseClient } from "../../supabase/client";
import type { DraftOrder, DraftOrderRepository, DraftOrderWriteInput } from "../types";
import type { DraftOrderStatus, SlipExtraction } from "@/types";

const COLUMNS = "id, dress, scan_image_path, extraction, warnings, status, confirmed_order_id, created_at";

interface DraftOrderRow {
  id: string;
  dress: string;
  scan_image_path: string;
  extraction: SlipExtraction;
  warnings: string[];
  status: DraftOrderStatus;
  confirmed_order_id: string | null;
  created_at: string;
}

function toDraftOrder(row: DraftOrderRow): DraftOrder {
  return {
    id: row.id,
    dress: row.dress,
    scanImagePath: row.scan_image_path,
    extraction: row.extraction,
    warnings: row.warnings ?? [],
    status: row.status,
    confirmedOrderId: row.confirmed_order_id,
    createdAt: row.created_at,
  };
}

export function createSupabaseDraftOrderRepository(): DraftOrderRepository {
  return {
    async list() {
      const { data, error } = await getSupabaseClient()
        .from("draft_orders")
        .select(COLUMNS)
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as DraftOrderRow[]).map(toDraftOrder);
    },

    async findById(id: string) {
      const { data, error } = await getSupabaseClient()
        .from("draft_orders")
        .select(COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toDraftOrder(data as DraftOrderRow) : null;
    },

    async create(input: DraftOrderWriteInput) {
      const { data, error } = await getSupabaseClient()
        .from("draft_orders")
        .insert({
          id: input.id,
          dress: input.dress,
          scan_image_path: input.scanImagePath,
          extraction: input.extraction,
          warnings: input.warnings,
        })
        .select(COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return toDraftOrder(data as DraftOrderRow);
    },

    async updateStatus(id: string, status: DraftOrderStatus, confirmedOrderId?: string) {
      const row: Record<string, unknown> = { status };
      if (confirmedOrderId !== undefined) row.confirmed_order_id = confirmedOrderId;

      const { data, error } = await getSupabaseClient()
        .from("draft_orders")
        .update(row)
        .eq("id", id)
        .select(COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return toDraftOrder(data as DraftOrderRow);
    },

    async delete(id: string) {
      const { error } = await getSupabaseClient().from("draft_orders").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
