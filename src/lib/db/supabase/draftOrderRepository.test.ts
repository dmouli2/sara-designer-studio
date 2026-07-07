import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSupabaseClient } from "../../supabase/client";
import { createSupabaseDraftOrderRepository } from "./draftOrderRepository";
import type { SlipExtraction } from "@/types";

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
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (r: QueryResult) => void) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

const extraction: SlipExtraction = {
  bookType: "Blouse",
  bookTypeConfidence: "high",
  billNo: "2392",
  date: "25/6",
  dueDate: "30/6",
  customerName: "Vaishnavi",
  customerNameConfidence: "high",
  phone: "9876543210",
  phoneConfidence: "high",
  measurements: [{ key: "length", value: "14", confidence: "high" }],
  lineItems: [{ particulars: "Blouse", qty: 1, amount: 400, confidence: "high" }],
  advance: "200",
  advanceConfidence: "high",
  writtenTotal: "400",
  writtenTotalConfidence: "high",
  extraNotes: [],
};

const draftRow = {
  id: "d1",
  dress: "Blouse",
  scan_image_path: "drafts/d1/scan-1.jpg",
  extraction,
  warnings: ["check phone"],
  status: "draft" as const,
  confirmed_order_id: null,
  created_at: "2026-07-06T00:00:00.000Z",
};

const draft = {
  id: "d1",
  dress: "Blouse",
  scanImagePath: "drafts/d1/scan-1.jpg",
  extraction,
  warnings: ["check phone"],
  status: "draft",
  confirmedOrderId: null,
  createdAt: "2026-07-06T00:00:00.000Z",
};

describe("createSupabaseDraftOrderRepository", () => {
  const from = vi.fn();

  beforeEach(() => {
    from.mockReset();
    vi.mocked(getSupabaseClient).mockReturnValue({ from } as never);
  });

  it("list returns only pending drafts, newest first", async () => {
    const query = fakeQuery({ data: [draftRow], error: null });
    from.mockReturnValue(query);
    const repo = createSupabaseDraftOrderRepository();

    const result = await repo.list();

    expect(from).toHaveBeenCalledWith("draft_orders");
    expect(query.eq).toHaveBeenCalledWith("status", "draft");
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual([draft]);
  });

  it("list defaults to an empty array when data is null", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: null }));
    expect(await createSupabaseDraftOrderRepository().list()).toEqual([]);
  });

  it("list throws on db error", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: { message: "list failed" } }));
    await expect(createSupabaseDraftOrderRepository().list()).rejects.toThrow("list failed");
  });

  it("findById maps the row and defaults missing warnings", async () => {
    const query = fakeQuery({ data: { ...draftRow, warnings: null }, error: null });
    from.mockReturnValue(query);

    const result = await createSupabaseDraftOrderRepository().findById("d1");

    expect(query.eq).toHaveBeenCalledWith("id", "d1");
    expect(result).toEqual({ ...draft, warnings: [] });
  });

  it("findById returns null when the draft doesn't exist", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: null }));
    expect(await createSupabaseDraftOrderRepository().findById("nope")).toBeNull();
  });

  it("findById throws on db error", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: { message: "find failed" } }));
    await expect(createSupabaseDraftOrderRepository().findById("d1")).rejects.toThrow("find failed");
  });

  it("create inserts snake_case columns and returns the mapped draft", async () => {
    const query = fakeQuery({ data: draftRow, error: null });
    from.mockReturnValue(query);

    const result = await createSupabaseDraftOrderRepository().create({
      id: "d1",
      dress: "Blouse",
      scanImagePath: "drafts/d1/scan-1.jpg",
      extraction,
      warnings: ["check phone"],
    });

    expect(query.insert).toHaveBeenCalledWith({
      id: "d1",
      dress: "Blouse",
      scan_image_path: "drafts/d1/scan-1.jpg",
      extraction,
      warnings: ["check phone"],
    });
    expect(result).toEqual(draft);
  });

  it("create throws on db error", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: { message: "insert failed" } }));
    await expect(
      createSupabaseDraftOrderRepository().create({
        id: "d1",
        dress: "Blouse",
        scanImagePath: "p",
        extraction,
        warnings: [],
      })
    ).rejects.toThrow("insert failed");
  });

  it("updateStatus sets status and optionally the confirmed order id", async () => {
    const confirmedRow = { ...draftRow, status: "confirmed" as const, confirmed_order_id: "B2401" };
    const query = fakeQuery({ data: confirmedRow, error: null });
    from.mockReturnValue(query);

    const result = await createSupabaseDraftOrderRepository().updateStatus("d1", "confirmed", "B2401");

    expect(query.update).toHaveBeenCalledWith({ status: "confirmed", confirmed_order_id: "B2401" });
    expect(query.eq).toHaveBeenCalledWith("id", "d1");
    expect(result.status).toBe("confirmed");
    expect(result.confirmedOrderId).toBe("B2401");
  });

  it("updateStatus without an order id only touches status", async () => {
    const query = fakeQuery({ data: { ...draftRow, status: "discarded" }, error: null });
    from.mockReturnValue(query);

    await createSupabaseDraftOrderRepository().updateStatus("d1", "discarded");

    expect(query.update).toHaveBeenCalledWith({ status: "discarded" });
  });

  it("updateStatus throws on db error", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: { message: "update failed" } }));
    await expect(
      createSupabaseDraftOrderRepository().updateStatus("d1", "confirmed", "B2401")
    ).rejects.toThrow("update failed");
  });

  it("delete removes the draft by id", async () => {
    const query = fakeQuery({ data: null, error: null });
    from.mockReturnValue(query);

    await createSupabaseDraftOrderRepository().delete("d1");

    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("id", "d1");
  });

  it("delete throws on db error", async () => {
    from.mockReturnValue(fakeQuery({ data: null, error: { message: "delete failed" } }));
    await expect(createSupabaseDraftOrderRepository().delete("d1")).rejects.toThrow("delete failed");
  });
});
