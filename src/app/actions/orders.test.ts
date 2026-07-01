import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireRole } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";
import { getOrders, getOrder, createOrder, assignStaff, updateOrderStatus, deleteOrder } from "./orders";
import { mockRefresh } from "../../../vitest.setup";
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
  referenceImageUrl: null,
  createdAt: "2026-06-01T00:00:00.000Z",
};

describe("orders actions", () => {
  const list = vi.fn();
  const findById = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const updateStatus = vi.fn();
  const deleteFn = vi.fn();
  const upload = vi.fn();
  const storageDelete = vi.fn();

  beforeEach(() => {
    list.mockReset();
    findById.mockReset();
    create.mockReset();
    update.mockReset();
    updateStatus.mockReset();
    deleteFn.mockReset();
    upload.mockReset();
    storageDelete.mockReset();
    upload.mockResolvedValue(undefined);
    storageDelete.mockResolvedValue(undefined);
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    vi.mocked(getDb).mockReturnValue({
      staff: {},
      orders: { list, findById, create, update, updateStatus, delete: deleteFn },
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

  it("createOrder requires admin and creates the order", async () => {
    create.mockResolvedValue(order);
    const result = await createOrder({ ...order, masterId: null, tailorId: null });
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(result).toEqual(order);
  });

  it("createOrder rejects a missing delivery date without touching the database", async () => {
    await expect(createOrder({ ...order, due: "", masterId: null, tailorId: null })).rejects.toThrow(
      "Delivery date is required."
    );
    expect(create).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("createOrder uploads base64 images to Storage and persists paths instead of raw data", async () => {
    create.mockResolvedValue(order);
    await createOrder({
      ...order,
      masterId: null,
      tailorId: null,
      sketchDataUrl: "data:image/png;base64,aGVsbG8=",
      referenceImageUrl: "data:image/jpeg;base64,d29ybGQ=",
    });

    expect(upload).toHaveBeenCalledWith("orders/SDS-001/sketch.png", "data:image/png;base64,aGVsbG8=");
    expect(upload).toHaveBeenCalledWith("orders/SDS-001/reference.jpg", "data:image/jpeg;base64,d29ybGQ=");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        sketchDataUrl: "orders/SDS-001/sketch.png",
        referenceImageUrl: "orders/SDS-001/reference.jpg",
      })
    );
  });

  it("createOrder skips uploads when no image data is provided", async () => {
    create.mockResolvedValue(order);
    await createOrder({ ...order, masterId: null, tailorId: null, sketchDataUrl: null, referenceImageUrl: null });
    expect(upload).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ sketchDataUrl: null, referenceImageUrl: null })
    );
  });

  it("assignStaff requires admin, updates master/tailor ids, refreshes the router, and returns the updated order", async () => {
    update.mockResolvedValue(order);
    const result = await assignStaff("SDS-001", "m1", "t1");
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(update).toHaveBeenCalledWith("SDS-001", { masterId: "m1", tailorId: "t1" });
    expect(mockRefresh).toHaveBeenCalled();
    expect(result).toEqual(order);
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

  it("deleteOrder requires admin, permanently deletes the order, and cleans up its stored images", async () => {
    deleteFn.mockResolvedValue(undefined);
    await deleteOrder("SDS-001");
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(deleteFn).toHaveBeenCalledWith("SDS-001");
    expect(storageDelete).toHaveBeenCalledWith("orders/SDS-001/sketch.png");
    expect(storageDelete).toHaveBeenCalledWith("orders/SDS-001/reference.jpg");
  });
});
