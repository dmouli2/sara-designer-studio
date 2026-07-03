import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSupabaseClient } from "../../supabase/client";
import { createSupabaseFabricRepository } from "./fabricRepository";

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
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (r: QueryResult) => void) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

const fabricRow = { id: "f1", name: "Silk", price: 350, created_at: "2026-07-01T00:00:00.000Z" };

describe("createSupabaseFabricRepository", () => {
  const from = vi.fn();

  beforeEach(() => {
    from.mockReset();
    vi.mocked(getSupabaseClient).mockReturnValue({ from } as never);
  });

  it("list returns fabrics ordered by name with numeric prices", async () => {
    const query = fakeQuery({ data: [{ ...fabricRow, price: "350" }], error: null });
    from.mockReturnValue(query);
    const repo = createSupabaseFabricRepository();

    const result = await repo.list();

    expect(from).toHaveBeenCalledWith("fabrics");
    expect(query.order).toHaveBeenCalledWith("name", { ascending: true });
    // numeric columns can arrive as strings — always coerced.
    expect(result).toEqual([{ id: "f1", name: "Silk", price: 350 }]);
  });

  it("list defaults to an empty array when data is null", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: null }));
    const repo = createSupabaseFabricRepository();
    expect(await repo.list()).toEqual([]);
  });

  it("list throws on db error", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: { message: "list failed" } }));
    const repo = createSupabaseFabricRepository();
    await expect(repo.list()).rejects.toThrow("list failed");
  });

  it("create inserts the fabric and returns it mapped", async () => {
    const query = fakeQuery({ data: fabricRow, error: null });
    from.mockReturnValue(query);
    const repo = createSupabaseFabricRepository();

    const result = await repo.create({ name: "Silk", price: 350 });

    expect(query.insert).toHaveBeenCalledWith({ name: "Silk", price: 350 });
    expect(result).toEqual({ id: "f1", name: "Silk", price: 350 });
  });

  it("create throws on db error (e.g. duplicate name)", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: { message: "duplicate key" } }));
    const repo = createSupabaseFabricRepository();
    await expect(repo.create({ name: "Silk", price: 350 })).rejects.toThrow("duplicate key");
  });

  it("update applies only the provided fields plus updated_at", async () => {
    const query = fakeQuery({ data: { ...fabricRow, price: 380 }, error: null });
    from.mockReturnValue(query);
    const repo = createSupabaseFabricRepository();

    const result = await repo.update("f1", { price: 380 });

    const patch = (query.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(patch.price).toBe(380);
    expect(patch).not.toHaveProperty("name");
    expect(patch.updated_at).toEqual(expect.any(String));
    expect(query.eq).toHaveBeenCalledWith("id", "f1");
    expect(result.price).toBe(380);
  });

  it("update can rename a fabric", async () => {
    const query = fakeQuery({ data: { ...fabricRow, name: "Pure Silk" }, error: null });
    from.mockReturnValue(query);
    const repo = createSupabaseFabricRepository();

    await repo.update("f1", { name: "Pure Silk" });

    const patch = (query.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(patch.name).toBe("Pure Silk");
    expect(patch).not.toHaveProperty("price");
  });

  it("update throws on db error", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: { message: "update failed" } }));
    const repo = createSupabaseFabricRepository();
    await expect(repo.update("f1", { price: 1 })).rejects.toThrow("update failed");
  });

  it("delete removes the fabric by id", async () => {
    const query = fakeQuery({ data: null, error: null });
    from.mockReturnValue(query);
    const repo = createSupabaseFabricRepository();

    await repo.delete("f1");

    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("id", "f1");
  });

  it("delete throws on db error", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: { message: "delete failed" } }));
    const repo = createSupabaseFabricRepository();
    await expect(repo.delete("f1")).rejects.toThrow("delete failed");
  });
});
