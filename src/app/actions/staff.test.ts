import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireRole } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { listStaff, getStaffMember, createStaff, updateStaff } from "./staff";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn() }));

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const account = {
  id: "s1",
  username: "anitha",
  passwordHash: "hash",
  name: "Anitha K.",
  role: "tailor" as const,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("listStaff", () => {
  const list = vi.fn();

  beforeEach(() => {
    list.mockReset();
    vi.mocked(requireRole).mockReset();
    vi.mocked(getDb).mockReturnValue({ staff: { list }, orders: {} } as never);
  });

  it("requires an admin session and maps accounts to list items", async () => {
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    list.mockResolvedValue([account]);

    const result = await listStaff({ role: "tailor" });

    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(list).toHaveBeenCalledWith({ role: "tailor" });
    expect(result).toEqual([
      { id: "s1", username: "anitha", name: "Anitha K.", role: "tailor", active: true },
    ]);
  });
});

describe("getStaffMember", () => {
  const findById = vi.fn();

  beforeEach(() => {
    findById.mockReset();
    vi.mocked(requireRole).mockReset();
    vi.mocked(getDb).mockReturnValue({ staff: { findById }, orders: {} } as never);
  });

  it("returns a mapped list item when found", async () => {
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    findById.mockResolvedValue(account);
    expect(await getStaffMember("s1")).toEqual({
      id: "s1",
      username: "anitha",
      name: "Anitha K.",
      role: "tailor",
      active: true,
    });
  });

  it("returns null when not found", async () => {
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    findById.mockResolvedValue(null);
    expect(await getStaffMember("missing")).toBeNull();
  });
});

describe("createStaff", () => {
  const findByUsername = vi.fn();
  const create = vi.fn();

  beforeEach(() => {
    findByUsername.mockReset();
    create.mockReset();
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    vi.mocked(getDb).mockReturnValue({ staff: { findByUsername, create }, orders: {} } as never);
    vi.mocked(hashPassword).mockResolvedValue("hashed");
  });

  it("returns a validation error for an invalid form", async () => {
    const result = await createStaff(undefined, formData({ username: "ab", password: "123", name: "", role: "tailor" }));
    expect(result.error).toBeTruthy();
    expect(findByUsername).not.toHaveBeenCalled();
  });

  it("returns an error when the username is already taken", async () => {
    findByUsername.mockResolvedValue(account);
    const result = await createStaff(
      undefined,
      formData({ username: "anitha", password: "secret1", name: "Anitha K.", role: "tailor" })
    );
    expect(result.error).toBe("That username is already taken.");
    expect(create).not.toHaveBeenCalled();
  });

  it("creates the staff account and redirects on success", async () => {
    findByUsername.mockResolvedValue(null);
    await expect(
      createStaff(undefined, formData({ username: "newuser", password: "secret1", name: "New Person", role: "master" }))
    ).rejects.toThrow("NEXT_REDIRECT:/admin/staff");

    expect(create).toHaveBeenCalledWith({
      username: "newuser",
      passwordHash: "hashed",
      name: "New Person",
      role: "master",
    });
  });
});

describe("updateStaff", () => {
  const update = vi.fn();
  const updatePassword = vi.fn();

  beforeEach(() => {
    update.mockReset();
    updatePassword.mockReset();
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    vi.mocked(getDb).mockReturnValue({ staff: { update, updatePassword }, orders: {} } as never);
    vi.mocked(hashPassword).mockResolvedValue("newhash");
  });

  it("returns a validation error for an invalid form", async () => {
    const result = await updateStaff(undefined, formData({ id: "s1", name: "", role: "tailor", active: "true" }));
    expect(result.error).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it("updates details without touching the password when none is provided", async () => {
    const result = await updateStaff(
      undefined,
      formData({ id: "s1", name: "Anitha K.", role: "tailor", active: "true" })
    );
    expect(result.success).toBe(true);
    expect(updatePassword).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith("s1", { name: "Anitha K.", role: "tailor", active: true });
  });

  it("rejects a too-short new password", async () => {
    const result = await updateStaff(
      undefined,
      formData({ id: "s1", name: "Anitha K.", role: "tailor", active: "true", password: "123" })
    );
    expect(result.error).toBe("Password must be at least 6 characters.");
    expect(update).not.toHaveBeenCalled();
  });

  it("resets the password when a new one is provided", async () => {
    const result = await updateStaff(
      undefined,
      formData({ id: "s1", name: "Anitha K.", role: "tailor", active: "false", password: "newsecret" })
    );
    expect(result.success).toBe(true);
    expect(updatePassword).toHaveBeenCalledWith("s1", "newhash");
    expect(update).toHaveBeenCalledWith("s1", { name: "Anitha K.", role: "tailor", active: false });
  });
});
