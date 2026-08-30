import { createHash, timingSafeEqual } from "node:crypto";

// Constant-time comparison for secrets.
//
// `a === b` on a token returns as soon as it reaches a differing byte, so how
// long it takes leaks how many leading characters the caller guessed right —
// which turns a secret into something guessable one character at a time.
//
// `timingSafeEqual` needs equal-length buffers and throws otherwise, and a
// length check of our own would leak the secret's length. So both sides are
// hashed to a fixed 32 bytes first and the digests are compared: equal inputs
// give equal digests, and unequal inputs of any length cost the same time.
export function safeCompare(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(a), digest(b));
}
