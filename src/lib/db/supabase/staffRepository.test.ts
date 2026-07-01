import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSupabaseClient } from "../../supabase/client";
import { createSupabaseStaffRepository } from "./staffRepository";

vi.mock("../../supabase/client", () => ({
  getSupabaseClient: vi.fn(),
}));

type QueryResult = { data: unknown; error: { message: string } | null };

function fakeQuery(result: QueryResult) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (r: QueryResult) => void) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

const row = {
  id: "s1",
  username: "anitha",
  password_hash: "hash",
  name: "Anitha K.",
  role: "tailor" as const,
  active: true,
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("createSupabaseStaffRepository", () => {
  const from = vi.fn();

  beforeEach(() => {
    from.mockReset();
    vi.mocked(getSupabaseClient).mockReturnValue({ from } as never);
  });

  it("findByUsername returns a mapped account when found", async () => {
    from.mockReturnValue(fakeQuery({ data: row, error: null }));
    const repo = createSupabaseStaffRepository();
    const result = await repo.findByUsername("anitha");
    expect(result).toEqual({
      id: "s1",
      username: "anitha",
      passwordHash: "hash",
      name: "Anitha K.",
      role: "tailor",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("findByUsername returns null when not found", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: null }));
    const repo = createSupabaseStaffRepository();
    expect(await repo.findByUsername("nobody")).toBeNull();
  });

  it("findByUsername throws on db error", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: { message: "boom" } }));
    const repo = createSupabaseStaffRepository();
    await expect(repo.findByUsername("anitha")).rejects.toThrow("boom");
  });

  it("findById returns a mapped account when found", async () => {
    from.mockReturnValue(fakeQuery({ data: row, error: null }));
    const repo = createSupabaseStaffRepository();
    expect(await repo.findById("s1")).toMatchObject({ id: "s1", name: "Anitha K." });
  });

  it("findById returns null when not found", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: null }));
    const repo = createSupabaseStaffRepository();
    expect(await repo.findById("missing")).toBeNull();
  });

  it("findById throws on db error", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: { message: "find failed" } }));
    const repo = createSupabaseStaffRepository();
    await expect(repo.findById("s1")).rejects.toThrow("find failed");
  });

  it("list returns all staff with no filter", async () => {
    const query = fakeQuery({ data: [row], error: null });
    from.mockReturnValue(query);
    const repo = createSupabaseStaffRepository();
    const result = await repo.list();
    expect(result).toHaveLength(1);
    expect(query.eq).not.toHaveBeenCalled();
  });

  it("list defaults to an empty array when data is null", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: null }));
    const repo = createSupabaseStaffRepository();
    expect(await repo.list()).toEqual([]);
  });

  it("list applies role and activeOnly filters", async () => {
    const query = fakeQuery({ data: [row], error: null });
    from.mockReturnValue(query);
    const repo = createSupabaseStaffRepository();
    await repo.list({ role: "tailor", activeOnly: true });
    expect(query.eq).toHaveBeenCalledWith("role", "tailor");
    expect(query.eq).toHaveBeenCalledWith("active", true);
  });

  it("list throws on db error", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: { message: "list failed" } }));
    const repo = createSupabaseStaffRepository();
    await expect(repo.list()).rejects.toThrow("list failed");
  });

  it("create inserts and returns the new account", async () => {
    from.mockReturnValue(fakeQuery({ data: row, error: null }));
    const repo = createSupabaseStaffRepository();
    const result = await repo.create({
      username: "anitha",
      passwordHash: "hash",
      name: "Anitha K.",
      role: "tailor",
    });
    expect(result.id).toBe("s1");
  });

  it("create throws on db error", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: { message: "insert failed" } }));
    const repo = createSupabaseStaffRepository();
    await expect(
      repo.create({ username: "x", passwordHash: "h", name: "X", role: "master" })
    ).rejects.toThrow("insert failed");
  });

  it("update applies every provided field", async () => {
    const query = fakeQuery({ data: { ...row, name: "New Name" }, error: null });
    from.mockReturnValue(query);
    const repo = createSupabaseStaffRepository();
    await repo.update("s1", { name: "New Name", role: "master", active: false });
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Name", role: "master", active: false })
    );
  });

  it("update with an empty patch only touches updated_at", async () => {
    const query = fakeQuery({ data: row, error: null });
    from.mockReturnValue(query);
    const repo = createSupabaseStaffRepository();
    await repo.update("s1", {});
    const arg = (query.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(Object.keys(arg)).toEqual(["updated_at"]);
  });

  it("update throws on db error", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: { message: "update failed" } }));
    const repo = createSupabaseStaffRepository();
    await expect(repo.update("s1", { name: "X" })).rejects.toThrow("update failed");
  });

  it("updatePassword succeeds without error", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: null }));
    const repo = createSupabaseStaffRepository();
    await expect(repo.updatePassword("s1", "newhash")).resolves.toBeUndefined();
  });

  it("updatePassword throws on db error", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: { message: "pw failed" } }));
    const repo = createSupabaseStaffRepository();
    await expect(repo.updatePassword("s1", "newhash")).rejects.toThrow("pw failed");
  });
});
