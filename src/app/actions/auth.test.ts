import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import { login, logoutAction } from "./auth";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(),
  // The real one runs a bcrypt hash; the tests only care that the unknown-user
  // path still spends a comparison rather than returning early.
  getDummyPasswordHash: vi.fn().mockResolvedValue("$2b$10$dummy"),
}));
vi.mock("@/lib/session", () => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
}));

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const staff = {
  id: "s1",
  username: "anitha",
  passwordHash: "hash",
  name: "Anitha K.",
  role: "tailor" as const,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("login", () => {
  const findByUsername = vi.fn();
  const getAttempts = vi.fn();
  const recordFailure = vi.fn();
  const clearAttempts = vi.fn();

  beforeEach(() => {
    findByUsername.mockReset();
    // Reset here too, or "was the password ever checked?" assertions see calls
    // left over from earlier tests in this file.
    vi.mocked(verifyPassword).mockReset();
    getAttempts.mockReset().mockResolvedValue(null);
    recordFailure.mockReset().mockResolvedValue({ failedCount: 1, lockedUntil: null });
    clearAttempts.mockReset().mockResolvedValue(undefined);
    vi.mocked(getDb).mockReturnValue({
      staff: { findByUsername },
      orders: {},
      loginAttempts: { get: getAttempts, recordFailure, clear: clearAttempts },
    } as never);
  });

  it("returns a validation error for empty fields", async () => {
    const result = await login(undefined, formData({ username: "", password: "" }));
    expect(result.error).toBeTruthy();
    expect(findByUsername).not.toHaveBeenCalled();
  });

  it("returns an invalid-credentials error for an unknown username", async () => {
    findByUsername.mockResolvedValue(null);
    const result = await login(undefined, formData({ username: "nobody", password: "x" }));
    expect(result.error).toBe("Invalid username or password.");
  });

  it("returns an invalid-credentials error for a deactivated account", async () => {
    findByUsername.mockResolvedValue({ ...staff, active: false });
    const result = await login(undefined, formData({ username: "anitha", password: "x" }));
    expect(result.error).toBe("Invalid username or password.");
  });

  it("returns an invalid-credentials error for a wrong password", async () => {
    findByUsername.mockResolvedValue(staff);
    vi.mocked(verifyPassword).mockResolvedValue(false);
    const result = await login(undefined, formData({ username: "anitha", password: "wrong" }));
    expect(result.error).toBe("Invalid username or password.");
    expect(createSession).not.toHaveBeenCalled();
  });

  it("creates a session and redirects an admin to /admin", async () => {
    findByUsername.mockResolvedValue({ ...staff, role: "admin" });
    vi.mocked(verifyPassword).mockResolvedValue(true);
    await expect(login(undefined, formData({ username: "admin", password: "x" }))).rejects.toThrow(
      "NEXT_REDIRECT:/admin"
    );
    expect(createSession).toHaveBeenCalledWith({
      staffId: "s1",
      username: "anitha",
      role: "admin",
      name: "Anitha K.",
    });
  });

  it("redirects a master to /master/queue", async () => {
    findByUsername.mockResolvedValue({ ...staff, role: "master" });
    vi.mocked(verifyPassword).mockResolvedValue(true);
    await expect(login(undefined, formData({ username: "ramesh", password: "x" }))).rejects.toThrow(
      "NEXT_REDIRECT:/master/queue"
    );
  });

  it("redirects a tailor to /tailor/queue", async () => {
    findByUsername.mockResolvedValue(staff);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    await expect(login(undefined, formData({ username: "anitha", password: "x" }))).rejects.toThrow(
      "NEXT_REDIRECT:/tailor/queue"
    );
  });

  // An unknown username used to return before hashing anything, answering in
  // ~1ms where a real one took ~100ms. That difference is measurable remotely
  // and enumerates the account list without a single password guess.
  it("still spends a password comparison when the username does not exist", async () => {
    findByUsername.mockResolvedValue(null);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await login(undefined, formData({ username: "nobody", password: "x" }));

    expect(verifyPassword).toHaveBeenCalledWith("x", "$2b$10$dummy");
  });

  it("still spends a password comparison for a deactivated account", async () => {
    findByUsername.mockResolvedValue({ ...staff, active: false });
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await login(undefined, formData({ username: "anitha", password: "x" }));

    // The dummy hash, not the real one — a deactivated account must not be
    // distinguishable from a missing one, by timing or by anything else.
    expect(verifyPassword).toHaveBeenCalledWith("x", "$2b$10$dummy");
  });

  describe("rate limiting", () => {
    it("records a failure against the username on a bad password", async () => {
      findByUsername.mockResolvedValue(staff);
      vi.mocked(verifyPassword).mockResolvedValue(false);

      await login(undefined, formData({ username: "anitha", password: "wrong" }));

      expect(recordFailure).toHaveBeenCalledWith("anitha", 5, 15 * 60 * 1000);
    });

    it("records a failure for an unknown username too", async () => {
      findByUsername.mockResolvedValue(null);
      vi.mocked(verifyPassword).mockResolvedValue(false);

      await login(undefined, formData({ username: "nobody", password: "x" }));

      expect(recordFailure).toHaveBeenCalledWith("nobody", 5, 15 * 60 * 1000);
    });

    it("tells the caller how long they are locked out for once the limit trips", async () => {
      findByUsername.mockResolvedValue(staff);
      vi.mocked(verifyPassword).mockResolvedValue(false);
      recordFailure.mockResolvedValue({
        failedCount: 5,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });

      const result = await login(undefined, formData({ username: "anitha", password: "wrong" }));

      expect(result.error).toMatch(/Too many failed attempts.*15 minutes/);
    });

    it("refuses a locked account without checking the password at all", async () => {
      getAttempts.mockResolvedValue({
        failedCount: 5,
        lockedUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });

      const result = await login(undefined, formData({ username: "anitha", password: "correct" }));

      expect(result.error).toMatch(/Too many failed attempts/);
      // Rejected before the expensive work, so a locked account cannot be used
      // to burn CPU either.
      expect(findByUsername).not.toHaveBeenCalled();
      expect(verifyPassword).not.toHaveBeenCalled();
    });

    it("lets a correct password through once the lockout has expired", async () => {
      getAttempts.mockResolvedValue({
        failedCount: 5,
        lockedUntil: new Date(Date.now() - 1000).toISOString(),
      });
      findByUsername.mockResolvedValue(staff);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      await expect(login(undefined, formData({ username: "anitha", password: "x" }))).rejects.toThrow(
        "NEXT_REDIRECT:/tailor/queue"
      );
    });

    it("wipes the failure count on a successful login", async () => {
      getAttempts.mockResolvedValue({ failedCount: 3, lockedUntil: null });
      findByUsername.mockResolvedValue(staff);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      await expect(login(undefined, formData({ username: "anitha", password: "x" }))).rejects.toThrow(
        "NEXT_REDIRECT:/tailor/queue"
      );
      expect(clearAttempts).toHaveBeenCalledWith("anitha");
    });
  });
});

describe("logoutAction", () => {
  it("deletes the session and redirects to /login", async () => {
    await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(deleteSession).toHaveBeenCalledTimes(1);
  });
});
