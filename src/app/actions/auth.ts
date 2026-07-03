"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import type { Role } from "@/types";

const LoginSchema = z.object({
  username: z.string().trim().min(1, { error: "Enter your username." }),
  password: z.string().min(1, { error: "Enter your password." }),
});

export interface LoginState {
  error?: string;
}

// Mirrors roleHome in src/proxy.ts — admin goes straight to /admin/orders
// so the post-login navigation is a single hop.
function roleHome(role: Role): string {
  return role === "admin" ? "/admin/orders" : `/${role}/queue`;
}

export async function login(_prevState: LoginState | undefined, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter your username and password." };
  }

  const staff = await getDb().staff.findByUsername(parsed.data.username);
  if (!staff || !staff.active) {
    return { error: "Invalid username or password." };
  }

  const passwordMatches = await verifyPassword(parsed.data.password, staff.passwordHash);
  if (!passwordMatches) {
    return { error: "Invalid username or password." };
  }

  await createSession({
    staffId: staff.id,
    username: staff.username,
    role: staff.role,
    name: staff.name,
  });

  redirect(roleHome(staff.role));
}

export async function logoutAction(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
