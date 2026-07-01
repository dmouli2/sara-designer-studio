import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import { login, logoutAction } from "./auth";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/password", () => ({ verifyPassword: vi.fn() }));
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

  beforeEach(() => {
    findByUsername.mockReset();
    vi.mocked(getDb).mockReturnValue({ staff: { findByUsername }, orders: {} } as never);
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
});

describe("logoutAction", () => {
  it("deletes the session and redirects to /login", async () => {
    await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(deleteSession).toHaveBeenCalledTimes(1);
  });
});
