import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionToken, decrypt } from "./session";
import { getDb } from "./db";
import type { Role } from "@/types";

export interface AuthenticatedUser {
  staffId: string;
  username: string;
  role: Role;
  name: string;
}

export const verifySession = cache(async (): Promise<AuthenticatedUser> => {
  const token = await getSessionToken();
  const payload = await decrypt(token);

  if (!payload) {
    redirect("/login");
  }

  const staff = await getDb().staff.findById(payload.staffId);
  if (!staff || !staff.active) {
    redirect("/login");
  }

  return { staffId: staff.id, username: staff.username, role: staff.role, name: staff.name };
});

export async function requireRole(roles: Role[]): Promise<AuthenticatedUser> {
  const user = await verifySession();
  if (!roles.includes(user.role)) {
    redirect(`/${user.role}`);
  }
  return user;
}
