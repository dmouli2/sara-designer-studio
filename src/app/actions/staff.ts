"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/dal";
import { getDb, type StaffAccount } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/types";

export interface StaffListItem {
  id: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
}

function toListItem({ id, username, name, role, active }: StaffAccount): StaffListItem {
  return { id, username, name, role, active };
}

export async function listStaff(filter?: { role?: Role; activeOnly?: boolean }): Promise<StaffListItem[]> {
  await requireRole(["admin"]);
  const staff = await getDb().staff.list(filter);
  return staff.map(toListItem);
}

export async function getStaffMember(id: string): Promise<StaffListItem | null> {
  await requireRole(["admin"]);
  const staff = await getDb().staff.findById(id);
  return staff ? toListItem(staff) : null;
}

export interface StaffFormState {
  error?: string;
  success?: boolean;
}

const CreateStaffSchema = z.object({
  username: z.string().trim().min(3, { error: "Username must be at least 3 characters." }),
  password: z.string().min(6, { error: "Password must be at least 6 characters." }),
  name: z.string().trim().min(1, { error: "Name is required." }),
  role: z.enum(["admin", "master", "tailor"], { error: "Choose a role." }),
});

export async function createStaff(
  _prevState: StaffFormState | undefined,
  formData: FormData
): Promise<StaffFormState> {
  await requireRole(["admin"]);

  const parsed = CreateStaffSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    name: formData.get("name"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const existing = await getDb().staff.findByUsername(parsed.data.username);
  if (existing) {
    return { error: "That username is already taken." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await getDb().staff.create({
    username: parsed.data.username,
    passwordHash,
    name: parsed.data.name,
    role: parsed.data.role,
  });

  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}

const UpdateStaffSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, { error: "Name is required." }),
  role: z.enum(["admin", "master", "tailor"], { error: "Choose a role." }),
  active: z.enum(["true", "false"]),
  password: z.string().optional(),
});

export async function updateStaff(
  _prevState: StaffFormState | undefined,
  formData: FormData
): Promise<StaffFormState> {
  await requireRole(["admin"]);

  const parsed = UpdateStaffSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    role: formData.get("role"),
    active: formData.get("active"),
    password: formData.get("password") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { id, name, role, active, password } = parsed.data;

  if (password) {
    if (password.length < 6) {
      return { error: "Password must be at least 6 characters." };
    }
    await getDb().staff.updatePassword(id, await hashPassword(password));
  }

  await getDb().staff.update(id, { name, role, active: active === "true" });

  revalidatePath("/admin/staff");
  revalidatePath(`/admin/staff/${id}`);
  return { success: true };
}
