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
    lt: vi.fn(() => builder),
    or: vi.fn(() => builder),
    range: vi.fn(() => builder),
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

// Shaped like a PostgREST row with the staff embeds (master/tailor joined in
// the same query through the master_id/tailor_id FKs).
const orderRow = {
  id: "SDS-001",
  customer: "Priya",
  phone: "999",
  dress: "Blouse",
  material: "Silk",
  status: "new",
  amount: 1000,
  advance: 300,
  advanceMethod: null,
  advanceSplit: null,
  finalPayment: 0,
  finalPaymentMethod: null,
  due: "2026-07-10",
  master: { id: "m1", name: "Ramesh K." },
  tailor: null,
  measurements,
  line_items: lineItems,
  notes: "",
  sketch_data_url: "orders/SDS-001/sketch.png",
  reference_image_urls: ["orders/SDS-001/reference-1.jpg", "orders/SDS-001/reference-2.jpg"],
  material_image_urls: ["orders/SDS-001/material-1.jpg"],
  cancellation_charge: null,
  created_at: "2026-06-01T00:00:00.000Z",
  public_token: "9f2b3c4d-1111-2222-3333-444455556666",
};

describe("createSupabaseOrderRepository", () => {
  const from = vi.fn();
  const rpc = vi.fn();
  const getSignedUrl = vi.fn();
  const getSignedUrls = vi.fn();

  beforeEach(() => {
    from.mockReset();
    rpc.mockReset();
    getSignedUrl.mockReset();
    getSignedUrl.mockImplementation(async (path: string) => `https://signed.example/${path}`);
    getSignedUrls.mockReset();
    // Independent of getSignedUrl (real batch calls never go through the
    // single-path Storage API) so tests asserting "getSignedUrl was never
    // called" for list-mode reads stay meaningful.
    getSignedUrls.mockImplementation((paths: string[]) =>
      Promise.resolve(paths.map((p) => `https://signed.example/${p}`))
    );
    vi.mocked(getSupabaseClient).mockReturnValue({ from, rpc } as never);
    vi.mocked(getImageStorage).mockReturnValue({
      upload: vi.fn(),
      getSignedUrl,
      getSignedUrls,
      delete: vi.fn(),
    });
  });

  function mockTables(ordersResult: QueryResult) {
    from.mockImplementation(() => fakeQuery(ordersResult));
  }

  it("list selects only the columns list views need, excluding image blobs", async () => {
    const ordersQuery = fakeQuery({ data: [orderRow], error: null });
    from.mockImplementation(() => ordersQuery);
    const repo = createSupabaseOrderRepository();
    await repo.list();

    const selectArg = (ordersQuery.select as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(selectArg).not.toBe("*");
    expect(selectArg).not.toContain("sketch_data_url");
    expect(selectArg).not.toContain("reference_image_url");
    // Assigned staff come embedded in the same query — no follow-up lookup.
    expect(selectArg).toContain("master:staff!orders_master_id_fkey");
    expect(selectArg).toContain("tailor:staff!orders_tailor_id_fkey");
  });

  it("list runs a single query — never a second staff lookup", async () => {
    mockTables({ data: [orderRow], error: null });
    const repo = createSupabaseOrderRepository();
    await repo.list();
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("orders");
  });

  it("list applies no narrowing when called without a filter", async () => {
    const ordersQuery = fakeQuery({ data: [orderRow], error: null });
    from.mockImplementation(() => ordersQuery);
    const repo = createSupabaseOrderRepository();
    await repo.list();
    expect(ordersQuery.in).not.toHaveBeenCalled();
    expect(ordersQuery.eq).not.toHaveBeenCalled();
    expect(ordersQuery.range).not.toHaveBeenCalled();
  });

  it("list pushes status/assignee filters and paging into the query", async () => {
    const ordersQuery = fakeQuery({ data: [orderRow], error: null });
    from.mockImplementation(() => ordersQuery);
    const repo = createSupabaseOrderRepository();
    await repo.list({
      statuses: ["new", "cutting"],
      masterId: "m1",
      tailorId: "t1",
      limit: 200,
      offset: 200,
    });
    expect(ordersQuery.in).toHaveBeenCalledWith("status", ["new", "cutting"]);
    expect(ordersQuery.eq).toHaveBeenCalledWith("master_id", "m1");
    expect(ordersQuery.eq).toHaveBeenCalledWith("tailor_id", "t1");
    expect(ordersQuery.range).toHaveBeenCalledWith(200, 399);
  });

  it("list defaults the paging offset to zero", async () => {
    const ordersQuery = fakeQuery({ data: [], error: null });
    from.mockImplementation(() => ordersQuery);
    const repo = createSupabaseOrderRepository();
    await repo.list({ limit: 50 });
    expect(ordersQuery.range).toHaveBeenCalledWith(0, 49);
  });

  it("list always returns empty/null sketch and reference fields, never resolved via getSignedUrl", async () => {
    mockTables({ data: [orderRow], error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.list();
    expect(result[0].sketchDataUrl).toBeNull();
    expect(result[0].referenceImageUrls).toEqual([]);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("list selects material_image_urls (cheap paths) alongside the other list columns", async () => {
    const ordersQuery = fakeQuery({ data: [orderRow], error: null });
    from.mockImplementation(() => ordersQuery);
    const repo = createSupabaseOrderRepository();
    await repo.list();
    const selectArg = (ordersQuery.select as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(selectArg).toContain("material_image_urls");
  });

  it("list resolves only the first material photo per row, in a single batch call", async () => {
    const rowB = { ...orderRow, id: "SDS-002", material_image_urls: ["orders/SDS-002/material-1.jpg"] };
    mockTables({ data: [orderRow, rowB], error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.list();

    expect(getSignedUrls).toHaveBeenCalledTimes(1);
    expect(getSignedUrls).toHaveBeenCalledWith(["orders/SDS-001/material-1.jpg", "orders/SDS-002/material-1.jpg"]);
    expect(result[0].mainMaterialImageUrl).toBe("https://signed.example/orders/SDS-001/material-1.jpg");
    expect(result[1].mainMaterialImageUrl).toBe("https://signed.example/orders/SDS-002/material-1.jpg");
    // The full gallery is never resolved in list mode — only the thumbnail.
    expect(result[0].materialImageUrls).toEqual([]);
    expect(result[1].materialImageUrls).toEqual([]);
  });

  it("list leaves mainMaterialImageUrl null for a row with no material photos, without including it in the batch request", async () => {
    mockTables({ data: [{ ...orderRow, material_image_urls: [] }], error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.list();
    expect(getSignedUrls).toHaveBeenCalledWith([]);
    expect(result[0].mainMaterialImageUrl).toBeNull();
  });

  it("list maps a main photo missing from the batch response to null", async () => {
    getSignedUrls.mockResolvedValue([null]);
    mockTables({ data: [orderRow], error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.list();
    expect(result[0].mainMaterialImageUrl).toBeNull();
  });

  it("list maps rows with their embedded master/tailor", async () => {
    mockTables({ data: [orderRow], error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.list();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "SDS-001", master: { id: "m1", name: "Ramesh K." }, tailor: null });
  });

  it("list maps a missing embed to an unassigned order", async () => {
    mockTables({ data: [{ ...orderRow, master: null }], error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.list();
    expect(result[0].master).toBeNull();
  });

  it("list defaults to an empty array when orders data is null", async () => {
    mockTables({ data: null, error: null });
    const repo = createSupabaseOrderRepository();
    expect(await repo.list()).toEqual([]);
  });

  it("list throws on orders query error", async () => {
    mockTables({ data: null, error: { message: "list failed" } });
    const repo = createSupabaseOrderRepository();
    await expect(repo.list()).rejects.toThrow("list failed");
  });

  it("findById resolves stored image paths to signed URLs", async () => {
    mockTables({ data: orderRow, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(getSignedUrl).toHaveBeenCalledWith("orders/SDS-001/sketch.png");
    expect(getSignedUrl).toHaveBeenCalledWith("orders/SDS-001/reference-1.jpg");
    expect(getSignedUrl).toHaveBeenCalledWith("orders/SDS-001/reference-2.jpg");
    expect(getSignedUrl).toHaveBeenCalledWith("orders/SDS-001/material-1.jpg");
    expect(result?.sketchDataUrl).toBe("https://signed.example/orders/SDS-001/sketch.png");
    expect(result?.referenceImageUrls).toEqual([
      "https://signed.example/orders/SDS-001/reference-1.jpg",
      "https://signed.example/orders/SDS-001/reference-2.jpg",
    ]);
    expect(result?.materialImageUrls).toEqual(["https://signed.example/orders/SDS-001/material-1.jpg"]);
    expect(result?.mainMaterialImageUrl).toBe("https://signed.example/orders/SDS-001/material-1.jpg");
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
    mockTables({
      data: { ...orderRow, sketch_data_url: null, reference_image_urls: [], material_image_urls: [] },
      error: null,
    });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(result?.sketchDataUrl).toBeNull();
    expect(result?.referenceImageUrls).toEqual([]);
    expect(result?.materialImageUrls).toEqual([]);
    expect(result?.mainMaterialImageUrl).toBeNull();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("findById derives mainMaterialImageUrl as null when the first material photo fails to resolve", async () => {
    getSignedUrl.mockImplementation(async (path: string) =>
      path.endsWith("material-1.jpg") ? null : `https://signed.example/${path}`
    );
    mockTables({ data: orderRow, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(result?.materialImageUrls).toEqual([]);
    expect(result?.mainMaterialImageUrl).toBeNull();
  });

  it("findById returns a mapped order when found", async () => {
    mockTables({ data: orderRow, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(result?.master).toEqual({ id: "m1", name: "Ramesh K." });
  });

  // The token is deliberately not a field on Order (it would then ride in
  // every list payload and both role queues), so it has its own narrow read.
  it("findPublicToken returns just the token for the id", async () => {
    mockTables({ data: { public_token: "tok-abc123" }, error: null });
    const repo = createSupabaseOrderRepository();
    expect(await repo.findPublicToken("SDS-001")).toBe("tok-abc123");
  });

  it("findPublicToken returns null when the order is gone", async () => {
    mockTables({ data: null, error: null });
    const repo = createSupabaseOrderRepository();
    expect(await repo.findPublicToken("nope")).toBeNull();
  });

  it("findPublicToken throws the Supabase error message", async () => {
    mockTables({ data: null, error: { message: "db down" } });
    const repo = createSupabaseOrderRepository();
    await expect(repo.findPublicToken("SDS-001")).rejects.toThrow("db down");
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

  it("findById moves a legacy salwar Height from M.Top to M.Pant", async () => {
    const legacySalwar = {
      type: "salwar",
      top: {
        oShalwar: "46", lShalwar: "44", length: "50", shoulder: "14",
        hs: "7", sl: "22", tlcs: "20", ah: "16",
        bust: "36", ub: "32", waist: "30", hip: "38",
        fnNr: "7", bn: "5", height: "160",
      },
      pant: { hip: "38", waist: "30", kl: "56", tl: "48", fullLength: "100", yoke: "12" },
      shawl: "",
    };
    mockTables({ data: { ...orderRow, measurements: legacySalwar }, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(result?.measurements).toMatchObject({
      top: { oShalwar: "46" },
      pant: { height: "160", hip: "38" },
    });
    expect((result?.measurements as { top: Record<string, unknown> }).top).not.toHaveProperty("height");
  });

  it("findById leaves an already-migrated salwar (Height under pant) untouched", async () => {
    const salwar = {
      type: "salwar",
      top: {
        oShalwar: "46", lShalwar: "44", length: "50", shoulder: "14",
        hs: "7", sl: "22", tlcs: "20", ah: "16",
        bust: "36", ub: "32", waist: "30", hip: "38",
        fnNr: "7", bn: "5",
      },
      pant: { height: "160", hip: "38", waist: "30", kl: "56", tl: "48", fullLength: "100", yoke: "12" },
      shawl: "",
    };
    mockTables({ data: { ...orderRow, measurements: salwar }, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(result?.measurements).toEqual(salwar);
  });

  it("findById leaves a salwar with neither top nor pant Height untouched", async () => {
    const salwar = {
      type: "salwar",
      top: {
        oShalwar: "46", lShalwar: "44", length: "50", shoulder: "14",
        hs: "7", sl: "22", tlcs: "20", ah: "16",
        bust: "36", ub: "32", waist: "30", hip: "38",
        fnNr: "7", bn: "5",
      },
      pant: { hip: "38", waist: "30", kl: "56", tl: "48", fullLength: "100", yoke: "12" },
      shawl: "",
    };
    mockTables({ data: { ...orderRow, measurements: salwar }, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findById("SDS-001");
    expect(result?.measurements).toEqual(salwar);
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
      advanceMethod: null,
      advanceSplit: null,
      finalPayment: 0,
      finalPaymentMethod: null,
      due: "2026-07-10",
      masterId: "m1",
      tailorId: null,
      measurements,
      lineItems,
      notes: "",
      sketchDataUrl: "orders/SDS-001/sketch.png",
      referenceImageUrls: ["orders/SDS-001/reference-1.jpg", "orders/SDS-001/reference-2.jpg"],
      materialImageUrls: ["orders/SDS-001/material-1.jpg"],
      cancellationCharge: null,
      deliveredOn: null,
      pieces: null,
      alterations: [],
      payments: [],
    });
    expect(result.master).toEqual({ id: "m1", name: "Ramesh K." });
    expect(result.sketchDataUrl).toBe("https://signed.example/orders/SDS-001/sketch.png");
    expect(result.materialImageUrls).toEqual(["https://signed.example/orders/SDS-001/material-1.jpg"]);
    expect(result.mainMaterialImageUrl).toBe("https://signed.example/orders/SDS-001/material-1.jpg");
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
        advanceMethod: null,
        advanceSplit: null,
        finalPayment: 0,
        finalPaymentMethod: null,
        due: "2026-07-10",
        measurements,
        lineItems,
        notes: "",
        sketchDataUrl: null,
        referenceImageUrls: [],
        materialImageUrls: [],
        cancellationCharge: null,
        deliveredOn: null,
        pieces: null,
        alterations: [],
        payments: [],
      })
    ).rejects.toThrow("insert failed");
  });

  it("update applies only the provided fields", async () => {
    const ordersQuery = fakeQuery({ data: orderRow, error: null });
    from.mockImplementation(() => ordersQuery);
    const repo = createSupabaseOrderRepository();
    await repo.update("SDS-001", { status: "cutting", tailorId: "t1" });
    expect(ordersQuery.update).toHaveBeenCalledWith({ status: "cutting", tailor_id: "t1" });
  });

  it("update maps every possible patch field to its column name", async () => {
    const ordersQuery = fakeQuery({ data: orderRow, error: null });
    from.mockImplementation(() => ordersQuery);
    const repo = createSupabaseOrderRepository();
    await repo.update("SDS-001", {
      customer: "New Customer",
      phone: "111",
      dress: "Salwar",
      material: "Cotton",
      status: "ready",
      amount: 500,
      advance: 100,
      advanceMethod: null,
      advanceSplit: { cash: 60, upi: 40 },
      finalPayment: 0,
      finalPaymentMethod: null,
      due: "2026-08-01",
      masterId: "m1",
      tailorId: "t1",
      measurements,
      lineItems,
      notes: "handle with care",
      sketchDataUrl: "orders/SDS-001/sketch.png",
      referenceImageUrls: ["orders/SDS-001/reference-1.jpg"],
      materialImageUrls: ["orders/SDS-001/material-1.jpg"],
      cancellationCharge: 500,
      deliveredOn: "2026-08-05",
      pieces: [{ id: "p1", label: "Blouse 1", due: "2026-08-01", status: "pending", deliveredAt: null }],
      alterations: [],
      payments: [{ id: "pay1", amount: 100, method: "cash", at: "2026-08-01T00:00:00Z", pieceId: "p1" }],
    });
    expect(ordersQuery.update).toHaveBeenCalledWith({
      customer: "New Customer",
      phone: "111",
      dress: "Salwar",
      material: "Cotton",
      status: "ready",
      amount: 500,
      advance: 100,
      advance_method: null,
      advance_split: { cash: 60, upi: 40 },
      final_payment: 0,
      final_payment_method: null,
      due: "2026-08-01",
      master_id: "m1",
      tailor_id: "t1",
      measurements,
      line_items: lineItems,
      notes: "handle with care",
      sketch_data_url: "orders/SDS-001/sketch.png",
      reference_image_urls: ["orders/SDS-001/reference-1.jpg"],
      material_image_urls: ["orders/SDS-001/material-1.jpg"],
      cancellation_charge: 500,
      delivered_on: "2026-08-05",
      pieces: [{ id: "p1", label: "Blouse 1", due: "2026-08-01", status: "pending", deliveredAt: null }],
      alterations: [],
      payments: [{ id: "pay1", amount: 100, method: "cash", at: "2026-08-01T00:00:00Z", pieceId: "p1" }],
    });
  });

  it("update throws on db error", async () => {
    mockTables({ data: null, error: { message: "update failed" } });
    const repo = createSupabaseOrderRepository();
    await expect(repo.update("SDS-001", { notes: "irrelevant" })).rejects.toThrow("update failed");
  });

  it("updateStatus delegates to update with the status merged in", async () => {
    const ordersQuery = fakeQuery({ data: orderRow, error: null });
    from.mockImplementation(() => ordersQuery);
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
    from.mockImplementation(() => ordersQuery);
    const repo = createSupabaseOrderRepository();
    await repo.findByPublicToken("9f2b3c4d-1111-2222-3333-444455556666");
    expect(ordersQuery.eq).toHaveBeenCalledWith("public_token", "9f2b3c4d-1111-2222-3333-444455556666");
  });

  it("findByPublicToken never queries staff and strips master/tailor/measurements from the result", async () => {
    const ordersQuery = fakeQuery({ data: orderRow, error: null });
    from.mockImplementation(() => ordersQuery);
    const repo = createSupabaseOrderRepository();
    const result = await repo.findByPublicToken("9f2b3c4d-1111-2222-3333-444455556666");
    expect(from).not.toHaveBeenCalledWith("staff");
    expect(result).not.toHaveProperty("master");
    expect(result).not.toHaveProperty("tailor");
    expect(result).not.toHaveProperty("measurements");
  });

  it("findByPublicToken resolves image paths to signed URLs like findById, including the full material gallery", async () => {
    mockTables({ data: orderRow, error: null });
    const repo = createSupabaseOrderRepository();
    const result = await repo.findByPublicToken("9f2b3c4d-1111-2222-3333-444455556666");
    expect(result?.sketchDataUrl).toBe("https://signed.example/orders/SDS-001/sketch.png");
    expect(result?.referenceImageUrls).toEqual([
      "https://signed.example/orders/SDS-001/reference-1.jpg",
      "https://signed.example/orders/SDS-001/reference-2.jpg",
    ]);
    expect(result?.materialImageUrls).toEqual(["https://signed.example/orders/SDS-001/material-1.jpg"]);
    expect(result?.mainMaterialImageUrl).toBe("https://signed.example/orders/SDS-001/material-1.jpg");
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

  it("listImageCleanupCandidates narrows to old finished orders that still hold image data", async () => {
    const ordersQuery = fakeQuery({
      data: [
        {
          id: "B2401",
          sketch_data_url: "orders/B2401/sketch.png",
          reference_image_urls: ["orders/B2401/reference-1.jpg"],
          material_image_urls: ["orders/B2401/material-1.jpg"],
        },
      ],
      error: null,
    });
    from.mockImplementation(() => ordersQuery);
    const repo = createSupabaseOrderRepository();
    const result = await repo.listImageCleanupCandidates("2026-04-01T00:00:00.000Z");

    expect(ordersQuery.in).toHaveBeenCalledWith("status", ["delivered", "cancelled"]);
    expect(ordersQuery.lt).toHaveBeenCalledWith("created_at", "2026-04-01T00:00:00.000Z");
    expect(ordersQuery.or).toHaveBeenCalledWith(
      "sketch_data_url.not.is.null,reference_image_urls.neq.{},material_image_urls.neq.{}"
    );
    expect(result).toEqual([
      {
        id: "B2401",
        sketchDataUrl: "orders/B2401/sketch.png",
        referenceImageUrls: ["orders/B2401/reference-1.jpg"],
        materialImageUrls: ["orders/B2401/material-1.jpg"],
      },
    ]);
  });

  it("listImageCleanupCandidates defaults null data and missing arrays safely", async () => {
    mockTables({ data: null, error: null });
    const repo = createSupabaseOrderRepository();
    expect(await repo.listImageCleanupCandidates("2026-04-01T00:00:00.000Z")).toEqual([]);

    mockTables({
      data: [{ id: "S1", sketch_data_url: null, reference_image_urls: null, material_image_urls: null }],
      error: null,
    });
    expect(await repo.listImageCleanupCandidates("2026-04-01T00:00:00.000Z")).toEqual([
      { id: "S1", sketchDataUrl: null, referenceImageUrls: [], materialImageUrls: [] },
    ]);
  });

  it("listImageCleanupCandidates throws on db error", async () => {
    mockTables({ data: null, error: { message: "cleanup scan failed" } });
    const repo = createSupabaseOrderRepository();
    await expect(repo.listImageCleanupCandidates("2026-04-01T00:00:00.000Z")).rejects.toThrow(
      "cleanup scan failed"
    );
  });
  describe("pieces / alterations / payments columns", () => {
    // Every row written before migration 0012 comes back with these absent.
    // Null pieces is meaningful — "this order is one garment" — and must be
    // preserved as null, while the two histories default to empty.
    it("reads a pre-0012 row as an unsplit, never-altered order", async () => {
      const { pieces: _p, alterations: _a, payments: _pay, ...legacyRow } = orderRow as Record<string, unknown>;
      void _p; void _a; void _pay;
      const ordersQuery = fakeQuery({ data: legacyRow, error: null });
      from.mockImplementation(() => ordersQuery);

      const result = await createSupabaseOrderRepository().findById("SDS-001");

      expect(result!.pieces).toBeNull();
      expect(result!.alterations).toEqual([]);
      expect(result!.payments).toEqual([]);
    });

    it("passes stored values straight through", async () => {
      const pieces = [
        { id: "p1", label: "Blouse 1", due: "2026-08-01", status: "delivered", deliveredAt: "2026-08-01T00:00:00Z" },
      ];
      const ordersQuery = fakeQuery({ data: { ...orderRow, pieces, alterations: [], payments: [] }, error: null });
      from.mockImplementation(() => ordersQuery);

      const result = await createSupabaseOrderRepository().findById("SDS-001");
      expect(result!.pieces).toEqual(pieces);
    });
  });
});
