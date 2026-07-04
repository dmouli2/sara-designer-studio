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
import { mockRefresh, mockRevalidatePath } from "../../../vitest.setup";
import { MAX_REFERENCE_IMAGES, MAX_MATERIAL_IMAGES } from "@/types";
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
  materialImageUrls: ["orders/SDS-001/material-1.jpg"],
  mainMaterialImageUrl: null,
  cancellationCharge: null,
  createdAt: "2026-06-01T00:00:00.000Z",
};

// The server allocates the id (via nextOrderId) and cancellationCharge only
// ever gets set via cancelOrder — callers of createOrder supply neither.
// mainMaterialImageUrl is always derived on read (never a write field), and
// the image fields don't ride in the input at all: photos travel as
// multipart Files in a separate FormData (matching createOrder's Omit list).
const {
  id: _omittedId,
  cancellationCharge: _omittedCharge,
  mainMaterialImageUrl: _omittedMain,
  sketchDataUrl: _omittedSketch,
  referenceImageUrls: _omittedRefs,
  materialImageUrls: _omittedMats,
  ...orderInput
} = order;
void _omittedId;
void _omittedCharge;
void _omittedMain;
void _omittedSketch;
void _omittedRefs;
void _omittedMats;

function photoFile(content: string, name: string, type = "image/jpeg"): File {
  return new File([content], name, { type });
}

function expectedDataUrl(content: string, type = "image/jpeg"): string {
  return `data:${type};base64,${Buffer.from(content).toString("base64")}`;
}

// Minimal valid photo set: createOrder requires at least one material photo.
function photosForm(entries?: { sketch?: File; reference?: File[]; material?: File[] }): FormData {
  const photos = new FormData();
  if (entries?.sketch) photos.append("sketch", entries.sketch);
  for (const f of entries?.reference ?? []) photos.append("reference", f);
  for (const f of entries?.material ?? [photoFile("fabric", "material-1.jpg")]) {
    photos.append("material", f);
  }
  return photos;
}

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
      getSignedUrls: vi.fn(),
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
    const result = await createOrder({ ...orderInput, masterId: null, tailorId: null }, photosForm());
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(nextOrderId).toHaveBeenCalledWith("Blouse");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: "SDS-001", cancellationCharge: null }));
    // revalidatePath alone doesn't bust the client router cache — without
    // refresh() the orders list stays stale and the new order never shows.
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/orders");
    expect(mockRefresh).toHaveBeenCalled();
    expect(result).toEqual(order);
  });

  it("createOrder rejects a missing delivery date without allocating an id or touching the database", async () => {
    await expect(
      createOrder({ ...orderInput, due: "", masterId: null, tailorId: null }, photosForm())
    ).rejects.toThrow("Delivery date is required.");
    expect(nextOrderId).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("createOrder rejects zero material photos without allocating an id or touching the database", async () => {
    await expect(
      createOrder({ ...orderInput, masterId: null, tailorId: null }, photosForm({ material: [] }))
    ).rejects.toThrow("At least one material photo is required.");
    expect(nextOrderId).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("createOrder ignores non-File entries smuggled into the photos FormData", async () => {
    const photos = photosForm({ material: [] });
    photos.append("material", "data:image/jpeg;base64,notafile");
    await expect(createOrder({ ...orderInput, masterId: null, tailorId: null }, photos)).rejects.toThrow(
      "At least one material photo is required."
    );
    expect(upload).not.toHaveBeenCalled();
  });

  it("createOrder uploads the multipart photos to Storage, keyed by the server-allocated id, and persists paths instead of raw data", async () => {
    create.mockResolvedValue(order);
    await createOrder(
      { ...orderInput, masterId: null, tailorId: null },
      photosForm({
        sketch: photoFile("hello", "sketch.png", "image/png"),
        reference: [photoFile("world", "reference-1.jpg"), photoFile("test", "reference-2.jpg")],
        material: [photoFile("fabric", "material-1.jpg")],
      })
    );

    expect(upload).toHaveBeenCalledWith("orders/SDS-001/sketch.png", expectedDataUrl("hello", "image/png"));
    expect(upload).toHaveBeenCalledWith("orders/SDS-001/reference-1.jpg", expectedDataUrl("world"));
    expect(upload).toHaveBeenCalledWith("orders/SDS-001/reference-2.jpg", expectedDataUrl("test"));
    expect(upload).toHaveBeenCalledWith("orders/SDS-001/material-1.jpg", expectedDataUrl("fabric"));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        sketchDataUrl: "orders/SDS-001/sketch.png",
        referenceImageUrls: ["orders/SDS-001/reference-1.jpg", "orders/SDS-001/reference-2.jpg"],
        materialImageUrls: ["orders/SDS-001/material-1.jpg"],
      })
    );
  });

  it("createOrder defaults a file with no content type to image/jpeg", async () => {
    create.mockResolvedValue(order);
    await createOrder(
      { ...orderInput, masterId: null, tailorId: null },
      photosForm({ material: [photoFile("fabric", "material-1.jpg", "")] })
    );
    expect(upload).toHaveBeenCalledWith("orders/SDS-001/material-1.jpg", expectedDataUrl("fabric"));
  });

  it("createOrder caps uploaded reference images to the max allowed", async () => {
    create.mockResolvedValue(order);
    const tooMany = Array.from({ length: MAX_REFERENCE_IMAGES + 2 }, (_, i) =>
      photoFile(`img${i}`, `reference-${i}.jpg`)
    );
    await createOrder({ ...orderInput, masterId: null, tailorId: null }, photosForm({ reference: tooMany }));

    // + 1 for the default material photo photosForm always includes.
    expect(upload).toHaveBeenCalledTimes(MAX_REFERENCE_IMAGES + 1);
    const created = create.mock.calls[0][0];
    expect(created.referenceImageUrls).toHaveLength(MAX_REFERENCE_IMAGES);
  });

  it("createOrder caps uploaded material images to the max allowed", async () => {
    create.mockResolvedValue(order);
    const tooMany = Array.from({ length: MAX_MATERIAL_IMAGES + 2 }, (_, i) =>
      photoFile(`img${i}`, `material-${i}.jpg`)
    );
    await createOrder({ ...orderInput, masterId: null, tailorId: null }, photosForm({ material: tooMany }));

    const created = create.mock.calls[0][0];
    expect(created.materialImageUrls).toHaveLength(MAX_MATERIAL_IMAGES);
  });

  it("createOrder uploads only the material photo when sketch and references are absent", async () => {
    create.mockResolvedValue(order);
    await createOrder({ ...orderInput, masterId: null, tailorId: null }, photosForm());
    expect(upload).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ sketchDataUrl: null, referenceImageUrls: [] })
    );
  });

  it("createOrder allocates a Salwar-series id when the order is a Salwar", async () => {
    create.mockResolvedValue(order);
    nextOrderId.mockResolvedValue("S2131");
    await createOrder({ ...orderInput, dress: "Salwar", masterId: null, tailorId: null }, photosForm());
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
    expect(storageDelete).toHaveBeenCalledTimes(MAX_REFERENCE_IMAGES + MAX_MATERIAL_IMAGES + 1);
    for (let i = 1; i <= MAX_REFERENCE_IMAGES; i++) {
      expect(storageDelete).toHaveBeenCalledWith(`orders/SDS-001/reference-${i}.jpg`);
    }
    for (let i = 1; i <= MAX_MATERIAL_IMAGES; i++) {
      expect(storageDelete).toHaveBeenCalledWith(`orders/SDS-001/material-${i}.jpg`);
    }
    expect(mockRefresh).toHaveBeenCalled();
  });
});
