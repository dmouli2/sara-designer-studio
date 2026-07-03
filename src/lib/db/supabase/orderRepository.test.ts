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
  reference_image_urls: ["orders/SDS-001/reference-1.jpg", "orders/SDS-001/reference-2.jpg"],
  cancellation_charge: null,
  created_at: "2026-06-01T00:00:00.000Z",
  public_token: "9f2b3c4d-1111-2222-3333-444455556666",
};

const staffRows = [{ id: "m1", name: "Ramesh K." }];

describe("createSupabaseOrderRepository", () => {
  const from = vi.fn();
  const rpc = vi.fn();
  const getSignedUrl = vi.fn();

  beforeEach(() => {
    from.mockReset();
    rpc.mockReset();
    getSignedUrl.mockReset();
    getSignedUrl.mockImplementation(async (path: string) => `https://signed.example/${path}`);
    vi.mocked(getSupabaseClient).mockReturnValue({ from, rpc } as never);
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

  it("list always returns empty/null image fields and never resolves signed URLs", async () => {
    mockTables({ data: [orderRow], error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.list();
    expect(result[0].sketchDataUrl).toBeNull();
    expect(result[0].referenceImageUrls).toEqual([]);
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
    expect(getSignedUrl).toHaveBeenCalledWith("orders/SDS-001/reference-1.jpg");
    expect(getSignedUrl).toHaveBeenCalledWith("orders/SDS-001/reference-2.jpg");
    expect(result?.sketchDataUrl).toBe("https://signed.example/orders/SDS-001/sketch.png");
    expect(result?.referenceImageUrls).toEqual([
      "https://signed.example/orders/SDS-001/reference-1.jpg",
      "https://signed.example/orders/SDS-001/reference-2.jpg",
    ]);
  });

  it("findById drops any reference image whose signed URL failed to resolve", async () => {
    getSignedUrl.mockImplementation(async (path: string) =>
      path.endsWith("reference-2.jpg") ? null : `https://signed.example/${path}`
    );
    mockTables({ data: orderRow, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(result?.referenceImageUrls).toEqual(["https://signed.example/orders/SDS-001/reference-1.jpg"]);
  });

  it("findById leaves image fields empty/null when none are stored", async () => {
    mockTables({ data: { ...orderRow, sketch_data_url: null, reference_image_urls: [] }, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(result?.sketchDataUrl).toBeNull();
    expect(result?.referenceImageUrls).toEqual([]);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("findById returns a mapped order when found", async () => {
    mockTables({ data: orderRow, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(result?.master).toEqual({ id: "m1", name: "Ramesh K." });
  });

  it("findById maps cancellationCharge from the row", async () => {
    mockTables({ data: { ...orderRow, cancellation_charge: 500 }, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(result?.cancellationCharge).toBe(500);
  });

  it("findById normalizes legacy { lb, ob } blouse measurements to plain L.B strings", async () => {
    const legacyBlouse = {
      type: "blouse",
      length: { lb: "52", ob: "53" },
      shoulder: { lb: "14", ob: "" },
      hs: { lb: "", ob: "" },
      sl: { lb: "", ob: "" },
      mlos: { lb: "", ob: "" },
      tlos: { lb: "", ob: "" },
      ahs: { lb: "", ob: "" },
      bust: { lb: "36", ob: "38" },
      ub: { lb: "32", ob: "" },
      waist: { lb: "", ob: "" },
      fnNr: { lb: "", ob: "" },
      bn: { lb: "", ob: "" },
      dart: "11",
      dbd: "",
      p: "",
      sareeFall: "",
      piko: "",
    };
    mockTables({ data: { ...orderRow, measurements: legacyBlouse }, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(result?.measurements).toMatchObject({
      type: "blouse",
      length: "52",
      shoulder: "14",
      bust: "36",
      ub: "32",
      dart: "11",
    });
  });

  it("findById defaults a blouse field that is neither a string nor a { lb } object to an empty string", async () => {
    const legacyBlouse = {
      type: "blouse",
      length: null,
      shoulder: "", hs: "", sl: "", mlos: "", tlos: "",
      ahs: "", bust: "", ub: "", waist: "", fnNr: "", bn: "",
      dart: "", dbd: "", p: "", sareeFall: "", piko: "",
    };
    mockTables({ data: { ...orderRow, measurements: legacyBlouse }, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(result?.measurements).toMatchObject({ length: "" });
  });

  it("findById leaves already-migrated (plain string) blouse measurements untouched", async () => {
    const blouse = {
      type: "blouse",
      length: "52", shoulder: "14", hs: "", sl: "", mlos: "", tlos: "",
      ahs: "", bust: "36", ub: "32", waist: "", fnNr: "", bn: "",
      dart: "11", dbd: "", p: "", sareeFall: "", piko: "",
    };
    mockTables({ data: { ...orderRow, measurements: blouse }, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(result?.measurements).toEqual(blouse);
  });

  it("findById leaves non-blouse measurements untouched", async () => {
    mockTables({ data: orderRow, error: null }); // orderRow uses generic measurements
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(result?.measurements).toEqual(measurements);
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
      referenceImageUrls: ["orders/SDS-001/reference-1.jpg", "orders/SDS-001/reference-2.jpg"],
      cancellationCharge: null,
    });
    expect(result.master).toEqual({ id: "m1", name: "Ramesh K." });
    expect(result.sketchDataUrl).toBe("https://signed.example/orders/SDS-001/sketch.png");
    expect(result.publicToken).toBe("9f2b3c4d-1111-2222-3333-444455556666");
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
        referenceImageUrls: [],
        cancellationCharge: null,
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
      referenceImageUrls: ["orders/SDS-001/reference-1.jpg"],
      cancellationCharge: 500,
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
      reference_image_urls: ["orders/SDS-001/reference-1.jpg"],
      cancellation_charge: 500,
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

  it("findByPublicToken looks up by the public_token column", async () => {
    const ordersQuery = fakeQuery({ data: orderRow, error: null });
    from.mockImplementation((table: string) => (table === "orders" ? ordersQuery : fakeQuery({ data: staffRows, error: null })));
    const repo = createSupabaseOrderRepository();
    await repo.findByPublicToken("9f2b3c4d-1111-2222-3333-444455556666");
    expect(ordersQuery.eq).toHaveBeenCalledWith("public_token", "9f2b3c4d-1111-2222-3333-444455556666");
  });

  it("findByPublicToken never queries staff and strips master/tailor/measurements from the result", async () => {
    const ordersQuery = fakeQuery({ data: orderRow, error: null });
    from.mockImplementation((table: string) => (table === "orders" ? ordersQuery : fakeQuery({ data: staffRows, error: null })));
    const repo = createSupabaseOrderRepository();
    const result = await repo.findByPublicToken("9f2b3c4d-1111-2222-3333-444455556666");
    expect(from).not.toHaveBeenCalledWith("staff");
    expect(result).not.toHaveProperty("master");
    expect(result).not.toHaveProperty("tailor");
    expect(result).not.toHaveProperty("measurements");
  });

  it("findByPublicToken resolves image paths to signed URLs like findById", async () => {
    mockTables({ data: orderRow, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findByPublicToken("9f2b3c4d-1111-2222-3333-444455556666");
    expect(result?.sketchDataUrl).toBe("https://signed.example/orders/SDS-001/sketch.png");
    expect(result?.referenceImageUrls).toEqual([
      "https://signed.example/orders/SDS-001/reference-1.jpg",
      "https://signed.example/orders/SDS-001/reference-2.jpg",
    ]);
  });

  it("findByPublicToken returns the rest of the order fields unchanged", async () => {
    mockTables({ data: orderRow, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findByPublicToken("9f2b3c4d-1111-2222-3333-444455556666");
    expect(result).toMatchObject({ id: "SDS-001", customer: "Priya", amount: 1000, advance: 300 });
  });

  it("findByPublicToken returns null when the token doesn't match any order", async () => {
    mockTables({ data: null, error: null });
    const repo = createSupabaseOrderRepository();
    expect(await repo.findByPublicToken("missing-token")).toBeNull();
  });

  it("findByPublicToken throws on db error", async () => {
    mockTables({ data: null, error: { message: "token lookup failed" } });
    const repo = createSupabaseOrderRepository();
    await expect(repo.findByPublicToken("bad")).rejects.toThrow("token lookup failed");
  });

  it("nextOrderId calls the next_order_id RPC with the dress type and returns the generated id", async () => {
    rpc.mockResolvedValue({ data: "S2131", error: null });
    const repo = createSupabaseOrderRepository();
    const id = await repo.nextOrderId("Salwar");
    expect(rpc).toHaveBeenCalledWith("next_order_id", { dress_type: "Salwar" });
    expect(id).toBe("S2131");
  });

  it("nextOrderId returns a blouse-series id for a blouse dress type", async () => {
    rpc.mockResolvedValue({ data: "B2401", error: null });
    const repo = createSupabaseOrderRepository();
    const id = await repo.nextOrderId("Blouse");
    expect(rpc).toHaveBeenCalledWith("next_order_id", { dress_type: "Blouse" });
    expect(id).toBe("B2401");
  });

  it("nextOrderId throws on db error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "sequence exhausted" } });
    const repo = createSupabaseOrderRepository();
    await expect(repo.nextOrderId("Blouse")).rejects.toThrow("sequence exhausted");
  });
});
