import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireRole } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";
import {
  getOrders,
  getOrder,
  createOrder,
  assignMaster,
  assignTailor,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
} from "./orders";
import { mockRefresh } from "../../../vitest.setup";
import { MAX_REFERENCE_IMAGES } from "@/types";
import type { GarmentMeasurements, OrderLineItem, Order } from "@/types";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/storage", () => ({ getImageStorage: vi.fn() }));

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

const order: Order = {
  id: "SDS-001",
  customer: "Priya",
  phone: "999",
  dress: "Blouse",
  material: "Silk",
  status: "new",
  amount: 1000,
  advance: 300,
  due: "2026-07-10",
  master: null,
  tailor: null,
  measurements,
  lineItems,
  notes: "",
  sketchDataUrl: null,
  referenceImageUrls: [],
  cancellationCharge: null,
  createdAt: "2026-06-01T00:00:00.000Z",
};

// The server allocates the id (via nextOrderId) and cancellationCharge only
// ever gets set via cancelOrder — callers of createOrder supply neither.
const { id: _omittedId, cancellationCharge: _omittedCharge, ...orderInput } = order;
void _omittedId;
void _omittedCharge;

describe("orders actions", () => {
  const list = vi.fn();
  const findById = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const updateStatus = vi.fn();
  const deleteFn = vi.fn();
  const nextOrderId = vi.fn();
  const upload = vi.fn();
  const storageDelete = vi.fn();

  beforeEach(() => {
    list.mockReset();
    findById.mockReset();
    create.mockReset();
    update.mockReset();
    updateStatus.mockReset();
    deleteFn.mockReset();
    nextOrderId.mockReset();
    nextOrderId.mockResolvedValue("SDS-001");
    upload.mockReset();
    storageDelete.mockReset();
    upload.mockResolvedValue(undefined);
    storageDelete.mockResolvedValue(undefined);
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    vi.mocked(getDb).mockReturnValue({
      staff: {},
      orders: { list, findById, create, update, updateStatus, delete: deleteFn, nextOrderId },
    } as never);
    vi.mocked(getImageStorage).mockReturnValue({
      upload,
      getSignedUrl: vi.fn(),
      delete: storageDelete,
    });
  });

  it("getOrders requires any staff session and lists orders", async () => {
    list.mockResolvedValue([order]);
    const result = await getOrders();
    expect(requireRole).toHaveBeenCalledWith(["admin", "master", "tailor"]);
    expect(result).toEqual([order]);
  });

  it("getOrder requires any staff session and fetches by id", async () => {
    findById.mockResolvedValue(order);
    const result = await getOrder("SDS-001");
    expect(findById).toHaveBeenCalledWith("SDS-001");
    expect(result).toEqual(order);
  });

  it("createOrder requires admin, allocates an id from the dress category's sequence, and creates the order", async () => {
    create.mockResolvedValue(order);
    const result = await createOrder({ ...orderInput, masterId: null, tailorId: null });
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(nextOrderId).toHaveBeenCalledWith("Blouse");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: "SDS-001", cancellationCharge: null }));
    expect(result).toEqual(order);
  });

  it("createOrder rejects a missing delivery date without allocating an id or touching the database", async () => {
    await expect(createOrder({ ...orderInput, due: "", masterId: null, tailorId: null })).rejects.toThrow(
      "Delivery date is required."
    );
    expect(nextOrderId).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("createOrder uploads base64 images to Storage, keyed by the server-allocated id, and persists paths instead of raw data", async () => {
    create.mockResolvedValue(order);
    await createOrder({
      ...orderInput,
      masterId: null,
      tailorId: null,
      sketchDataUrl: "data:image/png;base64,aGVsbG8=",
      referenceImageUrls: ["data:image/jpeg;base64,d29ybGQ=", "data:image/jpeg;base64,dGVzdA=="],
    });

    expect(upload).toHaveBeenCalledWith("orders/SDS-001/sketch.png", "data:image/png;base64,aGVsbG8=");
    expect(upload).toHaveBeenCalledWith("orders/SDS-001/reference-1.jpg", "data:image/jpeg;base64,d29ybGQ=");
    expect(upload).toHaveBeenCalledWith("orders/SDS-001/reference-2.jpg", "data:image/jpeg;base64,dGVzdA==");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        sketchDataUrl: "orders/SDS-001/sketch.png",
        referenceImageUrls: ["orders/SDS-001/reference-1.jpg", "orders/SDS-001/reference-2.jpg"],
      })
    );
  });

  it("createOrder caps uploaded reference images to the max allowed", async () => {
    create.mockResolvedValue(order);
    const tooMany = Array.from({ length: MAX_REFERENCE_IMAGES + 2 }, (_, i) => `data:image/jpeg;base64,img${i}`);
    await createOrder({ ...orderInput, masterId: null, tailorId: null, referenceImageUrls: tooMany });

    expect(upload).toHaveBeenCalledTimes(MAX_REFERENCE_IMAGES);
    const created = create.mock.calls[0][0];
    expect(created.referenceImageUrls).toHaveLength(MAX_REFERENCE_IMAGES);
  });

  it("createOrder skips uploads when no image data is provided", async () => {
    create.mockResolvedValue(order);
    await createOrder({ ...orderInput, masterId: null, tailorId: null, sketchDataUrl: null, referenceImageUrls: [] });
    expect(upload).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ sketchDataUrl: null, referenceImageUrls: [] })
    );
  });

  it("createOrder leaves an already-stored reference image path untouched instead of re-uploading it", async () => {
    create.mockResolvedValue(order);
    await createOrder({
      ...orderInput,
      masterId: null,
      tailorId: null,
      referenceImageUrls: ["orders/SDS-001/reference-1.jpg"],
    });
    expect(upload).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ referenceImageUrls: ["orders/SDS-001/reference-1.jpg"] })
    );
  });

  it("createOrder allocates a Salwar-series id when the order is a Salwar", async () => {
    create.mockResolvedValue(order);
    nextOrderId.mockResolvedValue("S2131");
    await createOrder({ ...orderInput, dress: "Salwar", masterId: null, tailorId: null });
    expect(nextOrderId).toHaveBeenCalledWith("Salwar");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: "S2131" }));
  });

  it("assignMaster requires admin, saves the assignment, and auto-advances a new order to cutting", async () => {
    findById.mockResolvedValue({ ...order, status: "new" });
    update.mockResolvedValue({ ...order, status: "cutting" });
    const result = await assignMaster("SDS-001", "m1");
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(findById).toHaveBeenCalledWith("SDS-001");
    expect(update).toHaveBeenCalledWith("SDS-001", { masterId: "m1", status: "cutting" });
    expect(mockRefresh).toHaveBeenCalled();
    expect(result.status).toBe("cutting");
  });

  it("assignMaster does not change status when the order has already moved past new", async () => {
    findById.mockResolvedValue({ ...order, status: "stitching" });
    update.mockResolvedValue({ ...order, status: "stitching" });
    await assignMaster("SDS-001", "m2");
    expect(update).toHaveBeenCalledWith("SDS-001", { masterId: "m2" });
  });

  it("assignMaster does not advance status when clearing the assignment", async () => {
    findById.mockResolvedValue({ ...order, status: "new" });
    update.mockResolvedValue(order);
    await assignMaster("SDS-001", null);
    expect(update).toHaveBeenCalledWith("SDS-001", { masterId: null });
  });

  it("assignMaster throws when the order doesn't exist", async () => {
    findById.mockResolvedValue(null);
    await expect(assignMaster("missing", "m1")).rejects.toThrow("Order not found.");
    expect(update).not.toHaveBeenCalled();
  });

  it("assignTailor requires admin, saves the assignment, and auto-advances a cutting_done order to stitching", async () => {
    findById.mockResolvedValue({ ...order, status: "cutting_done" });
    update.mockResolvedValue({ ...order, status: "stitching" });
    const result = await assignTailor("SDS-001", "t1");
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(update).toHaveBeenCalledWith("SDS-001", { tailorId: "t1", status: "stitching" });
    expect(mockRefresh).toHaveBeenCalled();
    expect(result.status).toBe("stitching");
  });

  it("assignTailor does not change status when cutting isn't done yet", async () => {
    findById.mockResolvedValue({ ...order, status: "cutting" });
    update.mockResolvedValue({ ...order, status: "cutting" });
    await assignTailor("SDS-001", "t1");
    expect(update).toHaveBeenCalledWith("SDS-001", { tailorId: "t1" });
  });

  it("assignTailor throws when the order doesn't exist", async () => {
    findById.mockResolvedValue(null);
    await expect(assignTailor("missing", "t1")).rejects.toThrow("Order not found.");
    expect(update).not.toHaveBeenCalled();
  });

  it("updateOrderStatus allows any staff role, updates status, refreshes the router, and returns the updated order", async () => {
    vi.mocked(requireRole).mockResolvedValue({ staffId: "t1", username: "anitha", role: "tailor", name: "Anitha K." });
    updateStatus.mockResolvedValue(order);
    const result = await updateOrderStatus("SDS-001", "ready");
    expect(requireRole).toHaveBeenCalledWith(["admin", "master", "tailor"]);
    expect(updateStatus).toHaveBeenCalledWith("SDS-001", "ready");
    expect(mockRefresh).toHaveBeenCalled();
    expect(result).toEqual(order);
  });

  it("cancelOrder requires admin, sets status to cancelled with the charge, refreshes the router, and returns the updated order", async () => {
    updateStatus.mockResolvedValue({ ...order, status: "cancelled", cancellationCharge: 500 });
    const result = await cancelOrder("SDS-001", 500);
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(updateStatus).toHaveBeenCalledWith("SDS-001", "cancelled", { cancellationCharge: 500 });
    expect(mockRefresh).toHaveBeenCalled();
    expect(result.status).toBe("cancelled");
    expect(result.cancellationCharge).toBe(500);
  });

  it("cancelOrder rejects a negative charge without touching the database", async () => {
    await expect(cancelOrder("SDS-001", -10)).rejects.toThrow("Enter a valid cancellation charge.");
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("cancelOrder rejects a non-finite charge without touching the database", async () => {
    await expect(cancelOrder("SDS-001", NaN)).rejects.toThrow("Enter a valid cancellation charge.");
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("cancelOrder accepts a zero charge", async () => {
    updateStatus.mockResolvedValue({ ...order, status: "cancelled", cancellationCharge: 0 });
    await cancelOrder("SDS-001", 0);
    expect(updateStatus).toHaveBeenCalledWith("SDS-001", "cancelled", { cancellationCharge: 0 });
  });

  it("deleteOrder requires admin, permanently deletes the order, and cleans up all its stored images", async () => {
    deleteFn.mockResolvedValue(undefined);
    await deleteOrder("SDS-001");
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(deleteFn).toHaveBeenCalledWith("SDS-001");
    expect(storageDelete).toHaveBeenCalledWith("orders/SDS-001/sketch.png");
    expect(storageDelete).toHaveBeenCalledTimes(MAX_REFERENCE_IMAGES + 1);
    for (let i = 1; i <= MAX_REFERENCE_IMAGES; i++) {
      expect(storageDelete).toHaveBeenCalledWith(`orders/SDS-001/reference-${i}.jpg`);
    }
  });
});
