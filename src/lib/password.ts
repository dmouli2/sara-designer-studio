import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

// A bcrypt hash at the same cost as every stored password, of a value nobody
// can present. The login action compares against this when the username does
// not exist, so the "no such user" path spends the same ~100ms hashing as a
// genuine one instead of returning instantly — which is what let anyone probe
// which usernames are real.
//
// Derived from fresh randomness at first use rather than hardcoded: a
// checked-in constant would be a published hash whose input a reader could
// eventually recognise, and there is no reason to take that on. Computed once
// per process and reused.
let dummyHash: string | null = null;

export async function getDummyPasswordHash(): Promise<string> {
  if (!dummyHash) {
    const { randomBytes } = await import("node:crypto");
    dummyHash = await bcrypt.hash(randomBytes(32).toString("hex"), SALT_ROUNDS);
  }
  return dummyHash;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
