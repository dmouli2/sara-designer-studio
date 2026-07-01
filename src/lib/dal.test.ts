import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSessionToken, decrypt } from "./session";
import { getDb } from "./db";
import { verifySession, requireRole } from "./dal";

vi.mock("./session", () => ({
  getSessionToken: vi.fn(),
  decrypt: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

const staff = {
  id: "s1",
  username: "anitha",
  passwordHash: "hash",
  name: "Anitha K.",
  role: "tailor" as const,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("verifySession", () => {
  const findById = vi.fn();

  beforeEach(() => {
    findById.mockReset();
    vi.mocked(getDb).mockReturnValue({ staff: { findById }, orders: {} } as never);
  });

  it("returns the authenticated user for a valid, active session", async () => {
    vi.mocked(getSessionToken).mockResolvedValue("token");
    vi.mocked(decrypt).mockResolvedValue({ staffId: "s1", username: "anitha", role: "tailor", name: "Anitha K." });
    findById.mockResolvedValue(staff);

    const user = await verifySession();
    expect(user).toEqual({ staffId: "s1", username: "anitha", role: "tailor", name: "Anitha K." });
  });

  it("redirects to /login when there is no session cookie", async () => {
    vi.mocked(getSessionToken).mockResolvedValue(undefined);
    vi.mocked(decrypt).mockResolvedValue(null);

    await expect(verifySession()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /login when the staff account no longer exists", async () => {
    vi.mocked(getSessionToken).mockResolvedValue("token");
    vi.mocked(decrypt).mockResolvedValue({ staffId: "gone", username: "x", role: "tailor", name: "X" });
    findById.mockResolvedValue(null);

    await expect(verifySession()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /login when the staff account has been deactivated", async () => {
    vi.mocked(getSessionToken).mockResolvedValue("token");
    vi.mocked(decrypt).mockResolvedValue({ staffId: "s1", username: "anitha", role: "tailor", name: "Anitha K." });
    findById.mockResolvedValue({ ...staff, active: false });

    await expect(verifySession()).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});

describe("requireRole", () => {
  const findById = vi.fn();

  beforeEach(() => {
    findById.mockReset();
    vi.mocked(getDb).mockReturnValue({ staff: { findById }, orders: {} } as never);
  });

  it("returns the user when their role is allowed", async () => {
    vi.mocked(getSessionToken).mockResolvedValue("token");
    vi.mocked(decrypt).mockResolvedValue({ staffId: "s1", username: "anitha", role: "tailor", name: "Anitha K." });
    findById.mockResolvedValue(staff);

    const user = await requireRole(["tailor", "master"]);
    expect(user.role).toBe("tailor");
  });

  it("redirects to the user's own role home when their role isn't allowed", async () => {
    vi.mocked(getSessionToken).mockResolvedValue("token");
    vi.mocked(decrypt).mockResolvedValue({ staffId: "s1", username: "anitha", role: "tailor", name: "Anitha K." });
    findById.mockResolvedValue(staff);

    await expect(requireRole(["admin"])).rejects.toThrow("NEXT_REDIRECT:/tailor");
  });
});
