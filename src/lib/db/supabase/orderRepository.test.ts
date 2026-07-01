import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSupabaseClient } from "../../supabase/client";
import { getImageStorage } from "../../storage";
import { createSupabaseOrderRepository } from "./orderRepository";
import type { GarmentMeasurements, OrderLineItem } from "@/types";

vi.mock("../../supabase/client", () => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock("../../storage", () => ({
  getImageStorage: vi.fn(),
}));

type QueryResult = { data: unknown; error: { message: string } | null };

function fakeQuery(result: QueryResult) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (r: QueryResult) => void) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

const measurements: GarmentMeasurements = {
  type: "generic",
  bust: "34",
  waist: "28",
  hip: "36",
  length: "40",
  shoulder: "14",
  sleeve: "20",
  neckDepth: "6",
  armRound: "15",
};

const lineItems: OrderLineItem[] = [{ particulars: "Blouse", qty: 1, amount: 1000 }];

const orderRow = {
  id: "SDS-001",
  customer: "Priya",
  phone: "999",
  dress: "Blouse",
  material: "Silk",
  status: "new",
  amount: 1000,
  advance: 300,
  due: "2026-07-10",
  master_id: "m1",
  tailor_id: null,
  measurements,
  line_items: lineItems,
  notes: "",
  sketch_data_url: "orders/SDS-001/sketch.png",
  reference_image_url: "orders/SDS-001/reference.jpg",
  created_at: "2026-06-01T00:00:00.000Z",
};

const staffRows = [{ id: "m1", name: "Ramesh K." }];

describe("createSupabaseOrderRepository", () => {
  const from = vi.fn();
  const getSignedUrl = vi.fn();

  beforeEach(() => {
    from.mockReset();
    getSignedUrl.mockReset();
    getSignedUrl.mockImplementation(async (path: string) => `https://signed.example/${path}`);
    vi.mocked(getSupabaseClient).mockReturnValue({ from } as never);
    vi.mocked(getImageStorage).mockReturnValue({
      upload: vi.fn(),
      getSignedUrl,
      delete: vi.fn(),
    });
  });

  function mockTables(ordersResult: QueryResult, staffResult: QueryResult = { data: staffRows, error: null }) {
    from.mockImplementation((table: string) =>
      table === "orders" ? fakeQuery(ordersResult) : fakeQuery(staffResult)
    );
  }

  it("list selects only the columns list views need, excluding image blobs", async () => {
    const ordersQuery = fakeQuery({ data: [orderRow], error: null });
    from.mockImplementation((table: string) => (table === "orders" ? ordersQuery : fakeQuery({ data: staffRows, error: null })));
    const repo = createSupabaseOrderRepository();
    await repo.list();

    const selectArg = (ordersQuery.select as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(selectArg).not.toBe("*");
    expect(selectArg).not.toContain("sketch_data_url");
    expect(selectArg).not.toContain("reference_image_url");
  });

  it("list always returns null image fields and never resolves signed URLs", async () => {
    mockTables({ data: [orderRow], error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.list();
    expect(result[0].sketchDataUrl).toBeNull();
    expect(result[0].referenceImageUrl).toBeNull();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("list resolves master/tailor names and maps rows", async () => {
    mockTables({ data: [orderRow], error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.list();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "SDS-001", master: { id: "m1", name: "Ramesh K." }, tailor: null });
  });

  it("list skips the staff lookup when there are no assignments", async () => {
    mockTables({ data: [{ ...orderRow, master_id: null }], error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.list();
    expect(result[0].master).toBeNull();
  });

  it("list treats a stale assignment id with no matching staff row as unassigned", async () => {
    mockTables({ data: [orderRow], error: null }, { data: [], error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.list();
    expect(result[0].master).toBeNull();
  });

  it("list defaults to an empty array when orders data is null", async () => {
    mockTables({ data: null, error: null });
    const repo = createSupabaseOrderRepository();
    expect(await repo.list()).toEqual([]);
  });

  it("list defaults staff name lookups to an empty map when staff data is null", async () => {
    mockTables({ data: [orderRow], error: null }, { data: null, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.list();
    expect(result[0].master).toBeNull();
  });

  it("list throws on orders query error", async () => {
    mockTables({ data: null, error: { message: "list failed" } });
    const repo = createSupabaseOrderRepository();
    await expect(repo.list()).rejects.toThrow("list failed");
  });

  it("list throws on staff lookup error", async () => {
    mockTables({ data: [orderRow], error: null }, { data: null, error: { message: "staff failed" } });
    const repo = createSupabaseOrderRepository();
    await expect(repo.list()).rejects.toThrow("staff failed");
  });

  it("findById resolves stored image paths to signed URLs", async () => {
    mockTables({ data: orderRow, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(getSignedUrl).toHaveBeenCalledWith("orders/SDS-001/sketch.png");
    expect(getSignedUrl).toHaveBeenCalledWith("orders/SDS-001/reference.jpg");
    expect(result?.sketchDataUrl).toBe("https://signed.example/orders/SDS-001/sketch.png");
    expect(result?.referenceImageUrl).toBe("https://signed.example/orders/SDS-001/reference.jpg");
  });

  it("findById leaves image fields null when no path is stored", async () => {
    mockTables({ data: { ...orderRow, sketch_data_url: null, reference_image_url: null }, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(result?.sketchDataUrl).toBeNull();
    expect(result?.referenceImageUrl).toBeNull();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("findById returns a mapped order when found", async () => {
    mockTables({ data: orderRow, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(result?.master).toEqual({ id: "m1", name: "Ramesh K." });
  });

  it("findById returns null when not found", async () => {
    mockTables({ data: null, error: null });
    const repo = createSupabaseOrderRepository();
    expect(await repo.findById("missing")).toBeNull();
  });

  it("findById throws on db error", async () => {
    mockTables({ data: null, error: { message: "find failed" } });
    const repo = createSupabaseOrderRepository();
    await expect(repo.findById("SDS-001")).rejects.toThrow("find failed");
  });

  it("create inserts and returns the mapped order with resolved image URLs", async () => {
    mockTables({ data: orderRow, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.create({
      id: "SDS-001",
      customer: "Priya",
      phone: "999",
      dress: "Blouse",
      material: "Silk",
      status: "new",
      amount: 1000,
      advance: 300,
      due: "2026-07-10",
      masterId: "m1",
      tailorId: null,
      measurements,
      lineItems,
      notes: "",
      sketchDataUrl: "orders/SDS-001/sketch.png",
      referenceImageUrl: "orders/SDS-001/reference.jpg",
    });
    expect(result.master).toEqual({ id: "m1", name: "Ramesh K." });
    expect(result.sketchDataUrl).toBe("https://signed.example/orders/SDS-001/sketch.png");
  });

  it("create throws on db error", async () => {
    mockTables({ data: null, error: { message: "insert failed" } });
    const repo = createSupabaseOrderRepository();
    await expect(
      repo.create({
        id: "SDS-002",
        customer: "X",
        phone: "1",
        dress: "Blouse",
        material: "Cotton",
        status: "new",
        amount: 0,
        advance: 0,
        due: "2026-07-10",
        measurements,
        lineItems,
        notes: "",
        sketchDataUrl: null,
        referenceImageUrl: null,
      })
    ).rejects.toThrow("insert failed");
  });

  it("update applies only the provided fields", async () => {
    const ordersQuery = fakeQuery({ data: orderRow, error: null });
    from.mockImplementation((table: string) =>
      table === "orders" ? ordersQuery : fakeQuery({ data: staffRows, error: null })
    );
    const repo = createSupabaseOrderRepository();
    await repo.update("SDS-001", { status: "cutting", tailorId: "t1" });
    expect(ordersQuery.update).toHaveBeenCalledWith({ status: "cutting", tailor_id: "t1" });
  });

  it("update maps every possible patch field to its column name", async () => {
    const ordersQuery = fakeQuery({ data: orderRow, error: null });
    from.mockImplementation((table: string) =>
      table === "orders" ? ordersQuery : fakeQuery({ data: staffRows, error: null })
    );
    const repo = createSupabaseOrderRepository();
    await repo.update("SDS-001", {
      customer: "New Customer",
      phone: "111",
      dress: "Salwar",
      material: "Cotton",
      status: "ready",
      amount: 500,
      advance: 100,
      due: "2026-08-01",
      masterId: "m1",
      tailorId: "t1",
      measurements,
      lineItems,
      notes: "handle with care",
      sketchDataUrl: "orders/SDS-001/sketch.png",
      referenceImageUrl: "orders/SDS-001/reference.jpg",
    });
    expect(ordersQuery.update).toHaveBeenCalledWith({
      customer: "New Customer",
      phone: "111",
      dress: "Salwar",
      material: "Cotton",
      status: "ready",
      amount: 500,
      advance: 100,
      due: "2026-08-01",
      master_id: "m1",
      tailor_id: "t1",
      measurements,
      line_items: lineItems,
      notes: "handle with care",
      sketch_data_url: "orders/SDS-001/sketch.png",
      reference_image_url: "orders/SDS-001/reference.jpg",
    });
  });

  it("update throws on db error", async () => {
    mockTables({ data: null, error: { message: "update failed" } });
    const repo = createSupabaseOrderRepository();
    await expect(repo.update("SDS-001", { notes: "irrelevant" })).rejects.toThrow("update failed");
  });

  it("updateStatus delegates to update with the status merged in", async () => {
    const ordersQuery = fakeQuery({ data: orderRow, error: null });
    from.mockImplementation((table: string) =>
      table === "orders" ? ordersQuery : fakeQuery({ data: staffRows, error: null })
    );
    const repo = createSupabaseOrderRepository();
    await repo.updateStatus("SDS-001", "delivered", { notes: "done" });
    expect(ordersQuery.update).toHaveBeenCalledWith({ status: "delivered", notes: "done" });
  });

  it("delete removes the order by id", async () => {
    const ordersQuery = fakeQuery({ data: null, error: null });
    from.mockReturnValue(ordersQuery);
    const repo = createSupabaseOrderRepository();
    await repo.delete("SDS-001");
    expect(from).toHaveBeenCalledWith("orders");
    expect(ordersQuery.eq).toHaveBeenCalledWith("id", "SDS-001");
  });

  it("delete throws on db error", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: { message: "delete failed" } }));
    const repo = createSupabaseOrderRepository();
    await expect(repo.delete("SDS-001")).rejects.toThrow("delete failed");
  });
});
