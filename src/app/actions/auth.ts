"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { verifyPassword, getDummyPasswordHash } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import type { Role } from "@/types";

// Five tries, then fifteen minutes off. Generous enough that a shop hand who
// has genuinely forgotten which of two passwords it is never meets it, and
// tight enough that guessing at scale is not worth attempting.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function minutesUntil(iso: string): number {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000));
}

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

  const { username, password } = parsed.data;

  // Refuse before touching the password at all, so a locked account costs an
  // attacker a database read rather than a bcrypt round.
  const attempts = await getDb().loginAttempts.get(username);
  if (attempts?.lockedUntil && new Date(attempts.lockedUntil) > new Date()) {
    return {
      error: `Too many failed attempts. Try again in ${minutesUntil(attempts.lockedUntil)} minutes.`,
    };
  }

  const staff = await getDb().staff.findByUsername(username);

  // Always run a bcrypt comparison, even when there is no such user.
  //
  // Returning early for an unknown username answered in about a millisecond
  // while a real one spent ~100ms hashing, and that gap is measurable over
  // the network — it let anyone enumerate which usernames exist without ever
  // guessing a password. Hashing against a throwaway hash of the same cost
  // makes both paths take the same time.
  const usable = staff && staff.active ? staff : null;
  const passwordMatches = await verifyPassword(
    password,
    usable ? usable.passwordHash : await getDummyPasswordHash()
  );

  if (!usable || !passwordMatches) {
    const after = await getDb().loginAttempts.recordFailure(username, MAX_FAILED_ATTEMPTS, LOCKOUT_MS);
    if (after.lockedUntil) {
      return {
        error: `Too many failed attempts. Try again in ${minutesUntil(after.lockedUntil)} minutes.`,
      };
    }
    return { error: "Invalid username or password." };
  }

  await getDb().loginAttempts.clear(username);

  await createSession({
    staffId: usable.id,
    username: usable.username,
    role: usable.role,
    name: usable.name,
  });

  redirect(roleHome(usable.role));
}

export async function logoutAction(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
