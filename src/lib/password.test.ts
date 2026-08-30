import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, getDummyPasswordHash } from "./password";

describe("password", () => {
  it("hashes a password to something other than the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toBe("correct horse battery staple");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("verifies a matching password against its hash", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("hunter2", hash)).toBe(true);
  });

  it("rejects a non-matching password", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  // Used by the login action so that "no such username" costs the same bcrypt
  // round as a real account, instead of returning instantly and advertising
  // which usernames exist.
  describe("getDummyPasswordHash", () => {
    it("returns a usable bcrypt hash at the same cost as a stored password", async () => {
      const dummy = await getDummyPasswordHash();
      expect(dummy).toMatch(/^\$2[aby]\$10\$/);
    });

    it("is computed once and reused for the life of the process", async () => {
      const first = await getDummyPasswordHash();
      const second = await getDummyPasswordHash();
      expect(second).toBe(first);
    });

    it("cannot be satisfied by any password a caller might send", async () => {
      const dummy = await getDummyPasswordHash();
      for (const guess of ["", "password", "admin", "hunter2"]) {
        expect(await verifyPassword(guess, dummy)).toBe(false);
      }
    });
  });
});
