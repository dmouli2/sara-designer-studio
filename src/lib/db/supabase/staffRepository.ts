import { getSupabaseClient } from "../../supabase/client";
import type {
  StaffRepository,
  StaffAccount,
  CreateStaffInput,
  UpdateStaffInput,
  StaffListFilter,
} from "../types";
import type { Role } from "@/types";

interface StaffRow {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  role: Role;
  active: boolean;
  created_at: string;
}

function toStaffAccount(row: StaffRow): StaffAccount {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    name: row.name,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
  };
}

export function createSupabaseStaffRepository(): StaffRepository {
  return {
    async findByUsername(username) {
      const { data, error } = await getSupabaseClient()
        .from("staff")
        .select("*")
        .eq("username", username)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toStaffAccount(data as StaffRow) : null;
    },

    async findById(id) {
      const { data, error } = await getSupabaseClient()
        .from("staff")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toStaffAccount(data as StaffRow) : null;
    },

    async list(filter?: StaffListFilter) {
      let query = getSupabaseClient().from("staff").select("*").order("name", { ascending: true });
      if (filter?.role) query = query.eq("role", filter.role);
      if (filter?.activeOnly) query = query.eq("active", true);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return ((data ?? []) as StaffRow[]).map(toStaffAccount);
    },

    async create(input: CreateStaffInput) {
      const { data, error } = await getSupabaseClient()
        .from("staff")
        .insert({
          username: input.username,
          password_hash: input.passwordHash,
          name: input.name,
          role: input.role,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return toStaffAccount(data as StaffRow);
    },

    async update(id: string, patch: UpdateStaffInput) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.role !== undefined) row.role = patch.role;
      if (patch.active !== undefined) row.active = patch.active;

      const { data, error } = await getSupabaseClient()
        .from("staff")
        .update(row)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return toStaffAccount(data as StaffRow);
    },

    async updatePassword(id: string, passwordHash: string) {
      const { error } = await getSupabaseClient()
        .from("staff")
        .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
