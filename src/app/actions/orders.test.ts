import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireRole } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";
import {
  getOrders,
  getOrder,
  getOrderShareToken,
  deliverOrder,
  createOrder,
  updateOrder,
  assignMaster,
  assignTailor,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
  deliverPiece,
  updatePieceDue,
  startAlteration,
  completeAlteration,
  redeliverAlteration,
  type OrderEditInput,
} from "./orders";
import { mockRefresh, mockRevalidatePath } from "../../../vitest.setup";
import { MAX_REFERENCE_IMAGES, MAX_MATERIAL_IMAGES } from "@/types";
import type { AlterationRecord, GarmentMeasurements, OrderLineItem, Order, OrderPiece } from "@/types";

// A payment is a split; a single-method one is the other side at zero.
const cash = (amount: number) => ({ cash: amount, upi: 0 });
const upi = (amount: number) => ({ cash: 0, upi: amount });

function piece(over: Partial<OrderPiece> = {}): OrderPiece {
  return { id: "p1", label: "Blouse 1", due: "2026-07-10", status: "pending", deliveredAt: null, ...over };
}

// A three-blouse order, half paid up front — the shape most of the
// piece-delivery tests below need.
function splitOrder(over: Partial<Order> = {}): Order {
  return {
    ...order,
    status: "ready",
    amount: 3000,
    advance: 1000,
    finalPayment: 0,
    pieces: [piece(), piece({ id: "p2", label: "Blouse 2" }), piece({ id: "p3", label: "Blouse 3" })],
    ...over,
  };
}

function alteration(over: Partial<AlterationRecord> = {}): AlterationRecord {
  return {
    id: "a1",
    reason: "Sleeve tight",
    pieceLabel: null,
    receivedAt: "2026-08-01",
    promisedAt: "2026-08-08",
    completedAt: null,
    redeliveredAt: null,
    ...over,
  };
}

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
  advanceMethod: null,
  advanceSplit: null,
  finalPayment: 0,
  finalPaymentMethod: null,
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
  deliveredOn: null,
  pieces: null,
  alterations: [],
  payments: [],
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
  // pieces arrive as drafts (label + date) and are built server-side;
  // alterations/payments are histories the server starts empty.
  pieces: _omittedPieces,
  alterations: _omittedAlterations,
  payments: _omittedPayments,
  ...orderInput
} = order;
void _omittedId;
void _omittedCharge;
void _omittedMain;
void _omittedSketch;
void _omittedRefs;
void _omittedMats;
void _omittedPieces;
void _omittedAlterations;
void _omittedPayments;

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
const findPublicToken = vi.fn();
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
      orders: { list, findById, findPublicToken, create, update, updateStatus, delete: deleteFn, nextOrderId },
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

  // Admin-only: the token is a bearer credential for that order's public
  // tracking page, and master/tailor have no reason to hand it out.
  it("getOrderShareToken requires admin and returns the tracking token", async () => {
    findPublicToken.mockResolvedValue("tok-abc123");
    const result = await getOrderShareToken("SDS-001");
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(findPublicToken).toHaveBeenCalledWith("SDS-001");
    expect(result).toBe("tok-abc123");
  });

  it("getOrderShareToken returns null for an order with no token", async () => {
    findPublicToken.mockResolvedValue(null);
    expect(await getOrderShareToken("SDS-001")).toBeNull();
  });

  // Money and hand-over happen together: no caller can mark an order
  // delivered without recording how the balance was settled.
  it("updateOrderStatus refuses to deliver — that must go through deliverOrder", async () => {
    await expect(updateOrderStatus("SDS-001", "delivered")).rejects.toThrow("Use deliverOrder");
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("deliverOrder settles the outstanding balance and records the method", async () => {
    findById.mockResolvedValue({ ...order, status: "ready", amount: 3000, advance: 500, finalPayment: 0 });
    updateStatus.mockResolvedValue(order);

    await deliverOrder("SDS-001", upi(2500));

    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(updateStatus).toHaveBeenCalledWith(
      "SDS-001",
      "delivered",
      expect.objectContaining({ finalPayment: 2500, finalPaymentMethod: "upi" })
    );
    // The collection is also written to the ledger, which is what lets an
    // order paid across several visits show where its money came from.
    expect(updateStatus.mock.calls[0][2].payments).toEqual([
      expect.objectContaining({ amount: 2500, method: "upi", pieceId: null }),
    ]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/orders");
  });

  // The amount comes from the stored order, never the client, so what gets
  // recorded is always exactly what was owed.
  it("deliverOrder ignores any client-supplied figure and uses the stored balance", async () => {
    findById.mockResolvedValue({ ...order, amount: 1200, advance: 200, finalPayment: 0 });
    updateStatus.mockResolvedValue(order);

    await deliverOrder("SDS-001", cash(1000));

    expect(updateStatus).toHaveBeenCalledWith(
      "SDS-001",
      "delivered",
      expect.objectContaining({ finalPayment: 1000, finalPaymentMethod: "cash" })
    );
  });

  it("deliverOrder records no method when there was nothing left to collect", async () => {
    findById.mockResolvedValue({ ...order, amount: 1000, advance: 1000, finalPayment: 0 });
    updateStatus.mockResolvedValue(order);

    await deliverOrder("SDS-001", cash(0));

    // Nothing arrived, so no ledger entry and no method claiming a payment
    // that never happened — only the day it was handed over.
    expect(updateStatus).toHaveBeenCalledWith("SDS-001", "delivered", {
      deliveredOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it("deliverOrder rejects an unknown payment method", async () => {
    await expect(deliverOrder("SDS-001", { cash: -1, upi: 0 })).rejects.toThrow("valid payment amount");
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("deliverOrder refuses a missing order", async () => {
    findById.mockResolvedValue(null);
    await expect(deliverOrder("nope", cash(0))).rejects.toThrow("Order not found");
  });

  it("deliverOrder refuses a cancelled order", async () => {
    findById.mockResolvedValue({ ...order, status: "cancelled" });
    await expect(deliverOrder("SDS-001", cash(0))).rejects.toThrow("cancelled order");
    expect(updateStatus).not.toHaveBeenCalled();
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

  // ── The measurement garment ("alavu blouse") ────────────────────────
  // Nothing is measured on these orders — the garment the customer left IS
  // the measurement — so the stored measurements must be the empty template,
  // whatever was typed into the form before the toggle went on.
  it("createOrder stores the empty template, not stale numbers, for a measurement-garment order", async () => {
    create.mockResolvedValue(order);

    await createOrder(
      { ...orderInput, dress: "Blouse", sampleGarment: true, masterId: null, tailorId: null },
      photosForm()
    );

    const written = create.mock.calls[0][0];
    expect(written.sampleGarment).toBe(true);
    expect(written.measurements).toEqual({
      type: "blouse",
      length: "", shoulder: "", hs: "", sl: "", mlos: "", tlos: "", ahs: "", ub: "",
      bust: "", waist: "", fnNr: "", bn: "", dart: "", dbd: "", p: "", sareeFall: "", piko: "",
    });
  });

  it("createOrder builds the salwar template for a measurement-salwar order", async () => {
    create.mockResolvedValue(order);

    await createOrder(
      { ...orderInput, dress: "Salwar", sampleGarment: true, masterId: null, tailorId: null },
      photosForm()
    );

    expect(create.mock.calls[0][0].measurements).toMatchObject({ type: "salwar", shawl: "" });
  });

  // An ordinary order is byte-for-byte what it always was: the measurements
  // it was given, and no flag riding along uninvited.
  it("createOrder leaves an ordinary order's measurements exactly as supplied", async () => {
    create.mockResolvedValue(order);

    await createOrder({ ...orderInput, masterId: null, tailorId: null }, photosForm());

    const written = create.mock.calls[0][0];
    expect(written.measurements).toEqual(measurements);
    expect(written.sampleGarment).toBeUndefined();
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

  it("createOrder allows zero material photos for a scanned order (scanOrder flag)", async () => {
    create.mockResolvedValue(order);
    const photos = photosForm({ material: [] });
    photos.append("scanOrder", "1");

    await createOrder({ ...orderInput, masterId: null, tailorId: null }, photos);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ id: "SDS-001", materialImageUrls: [] })
    );
    expect(upload).not.toHaveBeenCalled(); // no photos at all → nothing stored
  });

  it("createOrder still requires a material photo when the scanOrder flag is absent or wrong", async () => {
    const photos = photosForm({ material: [] });
    photos.append("scanOrder", "0");
    await expect(
      createOrder({ ...orderInput, masterId: null, tailorId: null }, photos)
    ).rejects.toThrow("At least one material photo is required.");
    expect(nextOrderId).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
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

  describe("updateOrder", () => {
    beforeEach(() => {
      findById.mockResolvedValue(order);
      update.mockResolvedValue(order);
    });

    it("requires admin, sends only the provided fields, and revalidates", async () => {
      const result = await updateOrder("SDS-001", { customer: "Meena", advance: 400 });
      expect(requireRole).toHaveBeenCalledWith(["admin"]);
      expect(update).toHaveBeenCalledWith("SDS-001", { customer: "Meena", advance: 400 });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/orders");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/orders/SDS-001");
      expect(mockRefresh).toHaveBeenCalled();
      expect(result).toEqual(order);
    });

    it("throws when the order doesn't exist", async () => {
      findById.mockResolvedValue(null);
      await expect(updateOrder("missing", { customer: "X" })).rejects.toThrow("Order not found.");
      expect(update).not.toHaveBeenCalled();
    });

    it.each(["delivered", "cancelled"] as const)("refuses to edit a %s order", async (status) => {
      findById.mockResolvedValue({ ...order, status });
      await expect(updateOrder("SDS-001", { customer: "X" })).rejects.toThrow(
        "Delivered or cancelled orders can no longer be edited."
      );
      expect(update).not.toHaveBeenCalled();
    });

    it("drops fields outside the editable whitelist (status, assignments, image columns)", async () => {
      const smuggled = {
        customer: "Meena",
        status: "delivered",
        masterId: "m1",
        materialImageUrls: ["orders/evil/material-1.jpg"],
      } as OrderEditInput;
      await updateOrder("SDS-001", smuggled);
      expect(update).toHaveBeenCalledWith("SDS-001", { customer: "Meena" });
    });

    // A customer who was measured can come back with a garment to copy, and
    // one whose blouse we hold can be measured after all — both directions
    // travel, and neither touches the stored measurements.
    it("carries the measurement-garment flag in both directions", async () => {
      await updateOrder("SDS-001", { sampleGarment: true });
      expect(update).toHaveBeenCalledWith("SDS-001", { sampleGarment: true });

      await updateOrder("SDS-001", { sampleGarment: false });
      expect(update).toHaveBeenLastCalledWith("SDS-001", { sampleGarment: false });
    });

    it("never clears the stored measurements when the flag goes on", async () => {
      await updateOrder("SDS-001", { sampleGarment: true });
      // Nothing about `measurements` rides along — the numbers stay put,
      // just unused, so switching the flag back off restores the order.
      expect(update.mock.calls[0][1]).not.toHaveProperty("measurements");
    });

    it("rejects clearing the delivery date", async () => {
      await expect(updateOrder("SDS-001", { due: "" })).rejects.toThrow("Delivery date is required.");
      expect(update).not.toHaveBeenCalled();
    });

    it.each([
      ["amount", { amount: -5 }, "Enter a valid total amount."],
      ["amount", { amount: NaN }, "Enter a valid total amount."],
      ["advance", { advance: -1 }, "Enter a valid advance amount."],
      ["advance", { advance: NaN }, "Enter a valid advance amount."],
    ])("rejects an invalid %s", async (_field, patch, message) => {
      await expect(updateOrder("SDS-001", patch)).rejects.toThrow(message);
      expect(update).not.toHaveBeenCalled();
    });

    it("returns the current order untouched when nothing changed", async () => {
      const result = await updateOrder("SDS-001", {});
      expect(update).not.toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
      expect(result).toEqual(order);
    });

    it("ignores a photos FormData without change flags", async () => {
      const photos = new FormData();
      photos.append("material", photoFile("fabric", "material-1.jpg"));
      const result = await updateOrder("SDS-001", {}, photos);
      expect(upload).not.toHaveBeenCalled();
      expect(storageDelete).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(result).toEqual(order);
    });

    it("replaces the sketch when flagged with a new file", async () => {
      const photos = new FormData();
      photos.append("sketchChanged", "1");
      photos.append("sketch", photoFile("redrawn", "sketch.png", "image/png"));
      await updateOrder("SDS-001", {}, photos);
      expect(upload).toHaveBeenCalledWith("orders/SDS-001/sketch.png", expectedDataUrl("redrawn", "image/png"));
      expect(update).toHaveBeenCalledWith("SDS-001", { sketchDataUrl: "orders/SDS-001/sketch.png" });
    });

    it("deletes the sketch when flagged with no file", async () => {
      const photos = new FormData();
      photos.append("sketchChanged", "1");
      await updateOrder("SDS-001", {}, photos);
      expect(storageDelete).toHaveBeenCalledWith("orders/SDS-001/sketch.png");
      expect(upload).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith("SDS-001", { sketchDataUrl: null });
    });

    it("rewrites the reference gallery: uploads the new set, deletes the leftover slots", async () => {
      const photos = new FormData();
      photos.append("referenceChanged", "1");
      photos.append("reference", photoFile("one", "reference-1.jpg"));
      photos.append("reference", photoFile("two", "reference-2.jpg"));
      await updateOrder("SDS-001", {}, photos);

      expect(upload).toHaveBeenCalledWith("orders/SDS-001/reference-1.jpg", expectedDataUrl("one"));
      expect(upload).toHaveBeenCalledWith("orders/SDS-001/reference-2.jpg", expectedDataUrl("two"));
      for (let i = 3; i <= MAX_REFERENCE_IMAGES; i++) {
        expect(storageDelete).toHaveBeenCalledWith(`orders/SDS-001/reference-${i}.jpg`);
      }
      expect(storageDelete).toHaveBeenCalledTimes(MAX_REFERENCE_IMAGES - 2);
      expect(update).toHaveBeenCalledWith("SDS-001", {
        referenceImageUrls: ["orders/SDS-001/reference-1.jpg", "orders/SDS-001/reference-2.jpg"],
      });
    });

    it("allows clearing the reference gallery entirely", async () => {
      const photos = new FormData();
      photos.append("referenceChanged", "1");
      await updateOrder("SDS-001", {}, photos);
      expect(storageDelete).toHaveBeenCalledTimes(MAX_REFERENCE_IMAGES);
      expect(update).toHaveBeenCalledWith("SDS-001", { referenceImageUrls: [] });
    });

    it("rewrites the material gallery but refuses to leave it empty", async () => {
      const photos = new FormData();
      photos.append("materialChanged", "1");
      await expect(updateOrder("SDS-001", {}, photos)).rejects.toThrow(
        "At least one material photo is required."
      );
      expect(update).not.toHaveBeenCalled();

      photos.append("material", photoFile("newfabric", "material-1.jpg"));
      await updateOrder("SDS-001", {}, photos);
      expect(upload).toHaveBeenCalledWith("orders/SDS-001/material-1.jpg", expectedDataUrl("newfabric"));
      for (let i = 2; i <= MAX_MATERIAL_IMAGES; i++) {
        expect(storageDelete).toHaveBeenCalledWith(`orders/SDS-001/material-${i}.jpg`);
      }
      expect(update).toHaveBeenCalledWith("SDS-001", {
        materialImageUrls: ["orders/SDS-001/material-1.jpg"],
      });
    });

    it("combines field and photo changes into one update", async () => {
      const photos = new FormData();
      photos.append("materialChanged", "1");
      photos.append("material", photoFile("fabric", "material-1.jpg"));
      const items: OrderLineItem[] = [{ particulars: "Blouse", qty: 2, amount: 700, note: "urgent" }];
      await updateOrder("SDS-001", { lineItems: items, amount: 1400 }, photos);
      expect(update).toHaveBeenCalledWith("SDS-001", {
        lineItems: items,
        amount: 1400,
        materialImageUrls: ["orders/SDS-001/material-1.jpg"],
      });
    });
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
    findById.mockResolvedValue(order);
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

  // ── Multi-piece orders ────────────────────────────────────────────────

  describe("createOrder with pieces", () => {
    it("stores nothing for a single-garment order", async () => {
      nextOrderId.mockResolvedValue("B2601");
      create.mockResolvedValue({ ...order, publicToken: "tok" });

      await createOrder(orderInput, photosForm());

      // Null, not an empty array — "this order is one garment", the shape
      // every order had before pieces existed.
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ pieces: null, alterations: [], payments: [] })
      );
    });

    it("builds ids and delivery state server-side from the wizard's drafts", async () => {
      nextOrderId.mockResolvedValue("B2601");
      create.mockResolvedValue({ ...order, publicToken: "tok" });

      await createOrder(
        {
          ...orderInput,
          due: "2026-07-20",
          pieces: [
            { label: "Blouse 1", due: "2026-07-10" },
            { label: "Blouse 2", due: "" },
          ],
        },
        photosForm()
      );

      expect(create.mock.calls[0][0].pieces).toEqual([
        { id: "p1", label: "Blouse 1", due: "2026-07-10", status: "pending", deliveredAt: null },
        { id: "p2", label: "Blouse 2", due: "2026-07-20", status: "pending", deliveredAt: null },
      ]);
    });
  });

  describe("deliverPiece", () => {
    it("hands one piece over, leaves the order open, and takes no money by default", async () => {
      findById.mockResolvedValue(splitOrder());
      updateStatus.mockResolvedValue(order);

      await deliverPiece("SDS-001", "p2");

      expect(requireRole).toHaveBeenCalledWith(["admin"]);
      const [id, status, extra] = updateStatus.mock.calls[0];
      expect([id, status]).toEqual(["SDS-001", "partly_delivered"]);
      expect(extra.pieces[1]).toMatchObject({ id: "p2", status: "delivered" });
      expect(extra.pieces[1].deliveredAt).toBeTruthy();
      expect(extra.pieces[0].status).toBe("pending");
      // No money changed hands, so nothing is recorded.
      expect(extra.finalPayment).toBeUndefined();
      expect(extra.payments).toBeUndefined();
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/orders");
    });

    it("records a part payment against the piece it came with", async () => {
      findById.mockResolvedValue(splitOrder());
      updateStatus.mockResolvedValue(order);

      await deliverPiece("SDS-001", "p1", upi(800));

      const extra = updateStatus.mock.calls[0][2];
      expect(extra.finalPayment).toBe(800);
      expect(extra.finalPaymentMethod).toBe("upi");
      expect(extra.payments).toEqual([
        expect.objectContaining({ amount: 800, method: "upi", pieceId: "p1" }),
      ]);
    });

    it("adds to money already collected rather than replacing it", async () => {
      findById.mockResolvedValue(
        splitOrder({
          finalPayment: 500,
          payments: [{ id: "x", amount: 500, method: "cash", at: "2026-07-01T00:00:00Z", pieceId: "p1" }],
          pieces: [
            piece({ status: "delivered" }),
            piece({ id: "p2", label: "Blouse 2" }),
            piece({ id: "p3", label: "Blouse 3" }),
          ],
        })
      );
      updateStatus.mockResolvedValue(order);

      await deliverPiece("SDS-001", "p2", cash(300));

      const extra = updateStatus.mock.calls[0][2];
      expect(extra.finalPayment).toBe(800);
      expect(extra.payments).toHaveLength(2);
    });

    // The last hand-over IS the order being delivered, so it settles on the
    // same rule as deliverOrder: exactly what's owed, computed server-side.
    it("settles the full remaining balance on the last piece", async () => {
      findById.mockResolvedValue(
        splitOrder({
          pieces: [
            piece({ status: "delivered" }),
            piece({ id: "p2", status: "delivered" }),
            piece({ id: "p3", label: "Blouse 3" }),
          ],
        })
      );
      updateStatus.mockResolvedValue(order);

      // The amount is not the admin's to choose on the last piece — it is
      // exactly what's owed, and a split that disagrees is refused rather
      // than silently rounded up to the balance.
      await expect(deliverPiece("SDS-001", "p3", cash(5))).rejects.toThrow("don't add up");

      await deliverPiece("SDS-001", "p3", cash(2000));
      const [, status, extra] = updateStatus.mock.calls[0];
      expect(status).toBe("delivered");
      expect(extra.finalPayment).toBe(2000); // 3000 - 1000 advance
    });

    // Refused rather than quietly clamped: recording ₹2,000 when the admin
    // typed ₹99,999 would be a number nobody entered.
    it("never collects more than the order owes", async () => {
      findById.mockResolvedValue(splitOrder());
      await expect(deliverPiece("SDS-001", "p1", cash(99999))).rejects.toThrow(
        "more than the order still owes"
      );
      expect(updateStatus).not.toHaveBeenCalled();
    });

    it("records nothing when the last piece goes out on a fully paid order", async () => {
      findById.mockResolvedValue(
        splitOrder({
          advance: 3000,
          pieces: [piece(), piece({ id: "p2", status: "delivered" }), piece({ id: "p3", status: "delivered" })],
        })
      );
      updateStatus.mockResolvedValue(order);

      await deliverPiece("SDS-001", "p1");

      const extra = updateStatus.mock.calls[0][2];
      expect(extra.finalPayment).toBeUndefined();
      expect(extra.finalPaymentMethod).toBeUndefined();
    });

    // Only the two states where handing a garment over is meaningless.
    it.each([
      ["cancelled" as const, "cancelled order"],
      ["delivered" as const, "already been handed over"],
    ])("refuses to hand a piece over from %s", async (status, message) => {
      findById.mockResolvedValue(splitOrder({ status }));
      await expect(deliverPiece("SDS-001", "p1")).rejects.toThrow(message);
      expect(updateStatus).not.toHaveBeenCalled();
    });

    // This shop never assigns a master or tailor, so its orders stay at
    // "new" for their whole life — gating hand-over on workflow progress
    // made the whole feature unusable there.
    it.each(["new", "cutting", "cutting_done", "stitching", "hemming_hook", "ready", "partly_delivered"] as const)(
      "hands a piece over from %s",
      async (status) => {
        findById.mockResolvedValue(splitOrder({ status }));
        updateStatus.mockResolvedValue(order);
        await expect(deliverPiece("SDS-001", "p1")).resolves.toBeDefined();
        expect(updateStatus).toHaveBeenCalledWith("SDS-001", "partly_delivered", expect.anything());
      }
    );

    it("refuses a missing order", async () => {
      findById.mockResolvedValue(null);
      await expect(deliverPiece("nope", "p1")).rejects.toThrow("Order not found");
    });

    it("refuses an order that isn't split", async () => {
      findById.mockResolvedValue({ ...order, status: "ready", pieces: null });
      await expect(deliverPiece("SDS-001", "p1")).rejects.toThrow("isn't split into pieces");
    });

    it("refuses a piece that isn't on the order", async () => {
      findById.mockResolvedValue(splitOrder());
      await expect(deliverPiece("SDS-001", "p9")).rejects.toThrow("isn't part of this order");
    });

    it("refuses a piece that already went out", async () => {
      findById.mockResolvedValue(splitOrder({ pieces: [piece({ status: "delivered" }), piece({ id: "p2" })] }));
      await expect(deliverPiece("SDS-001", "p1")).rejects.toThrow("already been handed over");
    });

    it("rejects a nonsense amount", async () => {
      findById.mockResolvedValue(splitOrder());
      await expect(deliverPiece("SDS-001", "p1", { cash: -5, upi: 0 })).rejects.toThrow(
        "valid payment amount"
      );
    });

    // Both sides at once is the whole point of a split.
    it("records a payment that arrived two ways", async () => {
      findById.mockResolvedValue(splitOrder());
      updateStatus.mockResolvedValue(order);

      await deliverPiece("SDS-001", "p1", { cash: 300, upi: 200 });

      const extra = updateStatus.mock.calls[0][2];
      expect(extra.finalPayment).toBe(500);
      // No single method describes it, so the ledger carries the breakdown.
      expect(extra.finalPaymentMethod).toBeNull();
      expect(extra.payments).toEqual([
        expect.objectContaining({ amount: 300, method: "cash", pieceId: "p1" }),
        expect.objectContaining({ amount: 200, method: "upi", pieceId: "p1" }),
      ]);
    });
  });

  describe("deliverOrder on a split order", () => {
    it("hands over everything still in the shop", async () => {
      findById.mockResolvedValue(
        splitOrder({ pieces: [piece({ status: "delivered", deliveredAt: "x" }), piece({ id: "p2" })] })
      );
      updateStatus.mockResolvedValue(order);

      await deliverOrder("SDS-001", cash(2000));

      const extra = updateStatus.mock.calls[0][2];
      expect(extra.pieces.every((p: OrderPiece) => p.status === "delivered")).toBe(true);
      // The one already gone keeps its original hand-over date.
      expect(extra.pieces[0].deliveredAt).toBe("x");
    });
  });

  describe("updatePieceDue", () => {
    it("moves a pending piece's date", async () => {
      findById.mockResolvedValue(splitOrder());
      update.mockResolvedValue(order);

      await updatePieceDue("SDS-001", "p2", "2026-08-01");

      expect(update.mock.calls[0][1].pieces[1].due).toBe("2026-08-01");
      expect(update.mock.calls[0][1].pieces[0].due).toBe("2026-07-10");
    });

    it("requires a date", async () => {
      await expect(updatePieceDue("SDS-001", "p1", "")).rejects.toThrow("Delivery date is required");
    });

    it("refuses a missing order, an unsplit order, an unknown piece and one already gone", async () => {
      findById.mockResolvedValue(null);
      await expect(updatePieceDue("x", "p1", "2026-08-01")).rejects.toThrow("Order not found");

      findById.mockResolvedValue({ ...order, pieces: null });
      await expect(updatePieceDue("x", "p1", "2026-08-01")).rejects.toThrow("isn't split");

      findById.mockResolvedValue(splitOrder());
      await expect(updatePieceDue("x", "p9", "2026-08-01")).rejects.toThrow("isn't part of this order");

      findById.mockResolvedValue(splitOrder({ pieces: [piece({ status: "delivered" })] }));
      await expect(updatePieceDue("x", "p1", "2026-08-01")).rejects.toThrow("already been handed over");
    });
  });

  // ── Alterations ───────────────────────────────────────────────────────

  describe("alterations", () => {
    it("takes a delivered garment back in without touching the order's status", async () => {
      findById.mockResolvedValue({ ...order, status: "delivered", alterations: [] });
      update.mockResolvedValue(order);

      await startAlteration("SDS-001", { reason: " Sleeve tight ", promisedAt: "2026-08-08" });

      expect(requireRole).toHaveBeenCalledWith(["admin"]);
      const patch = update.mock.calls[0][1];
      // The order stays delivered: revenue and the delivered count must not
      // move because a garment came back.
      expect(patch.status).toBeUndefined();
      expect(patch.alterations).toEqual([
        expect.objectContaining({
          reason: "Sleeve tight",
          promisedAt: "2026-08-08",
          pieceLabel: null,
          completedAt: null,
          redeliveredAt: null,
        }),
      ]);
      expect(patch.alterations[0].receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("records which garment came back on a split order", async () => {
      findById.mockResolvedValue({ ...splitOrder({ status: "delivered" }), alterations: [] });
      update.mockResolvedValue(order);

      await startAlteration("SDS-001", {
        reason: "",
        promisedAt: "2026-08-08",
        pieceLabel: "Blouse 2",
      });

      expect(update.mock.calls[0][1].alterations[0].pieceLabel).toBe("Blouse 2");
    });

    it("keeps earlier episodes when a garment comes back again", async () => {
      findById.mockResolvedValue({
        ...order,
        status: "delivered",
        alterations: [alteration({ redeliveredAt: "2026-07-20", completedAt: "2026-07-18" })],
      });
      update.mockResolvedValue(order);

      await startAlteration("SDS-001", { reason: "Hook", promisedAt: "2026-08-08" });

      expect(update.mock.calls[0][1].alterations).toHaveLength(2);
    });

    it("requires a promised date", async () => {
      await expect(startAlteration("SDS-001", { reason: "x", promisedAt: "" })).rejects.toThrow(
        "promised for"
      );
    });

    it("refuses a missing order", async () => {
      findById.mockResolvedValue(null);
      await expect(startAlteration("x", { reason: "", promisedAt: "2026-08-08" })).rejects.toThrow(
        "Order not found"
      );
    });

    it("refuses an order that was never delivered", async () => {
      findById.mockResolvedValue({ ...order, status: "ready", alterations: [] });
      await expect(startAlteration("x", { reason: "", promisedAt: "2026-08-08" })).rejects.toThrow(
        "Only a delivered order"
      );
    });

    it("refuses a second alteration while one is open", async () => {
      findById.mockResolvedValue({ ...order, status: "delivered", alterations: [alteration()] });
      await expect(startAlteration("x", { reason: "", promisedAt: "2026-08-08" })).rejects.toThrow(
        "already in alteration"
      );
    });

    it("marks the open alteration done", async () => {
      findById.mockResolvedValue({ ...order, status: "delivered", alterations: [alteration()] });
      update.mockResolvedValue(order);

      await completeAlteration("SDS-001");

      expect(update.mock.calls[0][1].alterations[0].completedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("leaves closed episodes alone when completing", async () => {
      findById.mockResolvedValue({
        ...order,
        status: "delivered",
        alterations: [alteration({ id: "old", redeliveredAt: "2026-07-01" }), alteration({ id: "a2" })],
      });
      update.mockResolvedValue(order);

      await completeAlteration("SDS-001");

      const [closed, open] = update.mock.calls[0][1].alterations;
      expect(closed.completedAt).toBeNull();
      expect(open.completedAt).toBeTruthy();
    });

    it("closes the record when the garment is handed back", async () => {
      findById.mockResolvedValue({
        ...order,
        status: "delivered",
        alterations: [alteration({ completedAt: "2026-08-05" })],
      });
      update.mockResolvedValue(order);

      await redeliverAlteration("SDS-001");

      expect(update.mock.calls[0][1].alterations[0].redeliveredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("refuses to complete or hand back when nothing is in alteration", async () => {
      findById.mockResolvedValue({ ...order, alterations: [] });
      await expect(completeAlteration("x")).rejects.toThrow("isn't in alteration");
      await expect(redeliverAlteration("x")).rejects.toThrow("isn't in alteration");
    });

    it("refuses to complete the same alteration twice", async () => {
      findById.mockResolvedValue({
        ...order,
        alterations: [alteration({ completedAt: "2026-08-05" })],
      });
      await expect(completeAlteration("x")).rejects.toThrow("already done");
    });

    it("refuses to hand back work that isn't finished", async () => {
      findById.mockResolvedValue({ ...order, alterations: [alteration()] });
      await expect(redeliverAlteration("x")).rejects.toThrow("Mark the alteration done");
    });

    it("refuses a missing order on the later steps", async () => {
      findById.mockResolvedValue(null);
      await expect(completeAlteration("x")).rejects.toThrow("Order not found");
      await expect(redeliverAlteration("x")).rejects.toThrow("Order not found");
    });
  });

  // Same rule as "delivered": it describes what physically left the shop, so
  // it can only be written by the action that moves a garment.
  it("updateOrderStatus refuses to set partly_delivered directly", async () => {
    await expect(updateOrderStatus("SDS-001", "partly_delivered")).rejects.toThrow("deliverPiece");
    expect(updateStatus).not.toHaveBeenCalled();
  });


  describe("updateOrder changing how many garments", () => {
    it("splits an existing single-garment order", async () => {
      findById.mockResolvedValue({ ...order, dress: "Blouse", due: "2026-07-10", pieces: null });
      update.mockResolvedValue(order);

      await updateOrder("SDS-001", { pieceCount: 3 });

      expect(update.mock.calls[0][1].pieces).toEqual([
        { id: "p1", label: "Blouse 1", due: "2026-07-10", status: "pending", deliveredAt: null },
        { id: "p2", label: "Blouse 2", due: "2026-07-10", status: "pending", deliveredAt: null },
        { id: "p3", label: "Blouse 3", due: "2026-07-10", status: "pending", deliveredAt: null },
      ]);
    });

    // A garment added in the same edit that moves the date should follow the
    // new date, not the one being replaced.
    it("gives a new garment the delivery date set in the same edit", async () => {
      findById.mockResolvedValue({ ...order, dress: "Blouse", due: "2026-07-10", pieces: null });
      update.mockResolvedValue(order);

      await updateOrder("SDS-001", { pieceCount: 2, due: "2026-09-30" });

      expect(update.mock.calls[0][1].pieces.every((p: OrderPiece) => p.due === "2026-09-30")).toBe(true);
    });

    it("puts a split order back to a single garment", async () => {
      findById.mockResolvedValue(splitOrder({ status: "ready" }));
      update.mockResolvedValue(order);

      await updateOrder("SDS-001", { pieceCount: 1 });

      expect(update.mock.calls[0][1].pieces).toBeNull();
    });

    it("refuses to edit away a garment already with the customer", async () => {
      findById.mockResolvedValue(
        splitOrder({
          status: "partly_delivered",
          pieces: [
            piece({ status: "delivered", deliveredAt: "x" }),
            piece({ id: "p2", label: "Blouse 2" }),
            piece({ id: "p3", label: "Blouse 3" }),
          ],
        })
      );
      await expect(updateOrder("SDS-001", { pieceCount: 1 })).rejects.toThrow(
        "Hand the last piece over instead"
      );
      expect(update).not.toHaveBeenCalled();
    });

    it("writes nothing when the count hasn't moved", async () => {
      findById.mockResolvedValue(splitOrder({ status: "ready" }));

      const result = await updateOrder("SDS-001", { pieceCount: 3 });

      expect(update).not.toHaveBeenCalled();
      expect(result.id).toBe("SDS-001");
    });

    // Delivered and cancelled orders are final records, count included.
    it("still refuses any edit to a finished order", async () => {
      findById.mockResolvedValue({ ...order, status: "delivered" });
      await expect(updateOrder("SDS-001", { pieceCount: 3 })).rejects.toThrow("no longer be edited");
    });
  });


  describe("the hand-over date", () => {
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

    it("defaults to today when none is given", async () => {
      findById.mockResolvedValue(splitOrder());
      updateStatus.mockResolvedValue(order);

      await deliverPiece("SDS-001", "p1");

      expect(updateStatus.mock.calls[0][2].pieces[0].deliveredAt).toMatch(ISO_DATE);
    });

    // The shop records a hand-over when it gets a moment, not at the counter.
    it("backdates the garment and the money together", async () => {
      findById.mockResolvedValue(splitOrder());
      updateStatus.mockResolvedValue(order);

      await deliverPiece("SDS-001", "p1", cash(400), "2026-08-20");

      const extra = updateStatus.mock.calls[0][2];
      expect(extra.pieces[0].deliveredAt).toBe("2026-08-20");
      // The ledger says the day the money arrived, not the day it was typed in.
      expect(extra.payments[0].at).toBe("2026-08-20");
    });

    it("refuses a future date", async () => {
      findById.mockResolvedValue(splitOrder());
      await expect(deliverPiece("SDS-001", "p1", undefined, "2099-01-01")).rejects.toThrow(
        "That hand-over date is in the future"
      );
      expect(updateStatus).not.toHaveBeenCalled();
    });

    it("refuses a malformed date", async () => {
      findById.mockResolvedValue(splitOrder());
      await expect(deliverPiece("SDS-001", "p1", undefined, "20/08/2026")).rejects.toThrow(
        "valid hand-over date"
      );
    });

    it("dates the whole-order delivery today", async () => {
      findById.mockResolvedValue(splitOrder());
      updateStatus.mockResolvedValue(order);

      // splitOrder owes 2000 (3000 less a 1000 advance).
      await deliverOrder("SDS-001", cash(2000));

      const extra = updateStatus.mock.calls[0][2];
      expect(extra.pieces.every((p: OrderPiece) => ISO_DATE.test(p.deliveredAt!))).toBe(true);
      expect(extra.payments[0].at).toMatch(ISO_DATE);
    });
  });


  // Every date the admin records follows the same rule, so each action that
  // takes one is checked for it rather than trusting the shared helper.
  describe("dates on the other actions", () => {
    const ISO = /^\d{4}-\d{2}-\d{2}$/;

    it("deliverOrder records the day it went home", async () => {
      findById.mockResolvedValue({ ...order, amount: 1000, advance: 0, finalPayment: 0 });
      updateStatus.mockResolvedValue(order);

      await deliverOrder("SDS-001", cash(1000), "2026-08-20");

      const extra = updateStatus.mock.calls[0][2];
      expect(extra.deliveredOn).toBe("2026-08-20");
      expect(extra.payments[0].at).toBe("2026-08-20");
    });

    it("the last piece dates the order as well as itself", async () => {
      findById.mockResolvedValue(
        splitOrder({ pieces: [piece({ id: "p1" })] })
      );
      updateStatus.mockResolvedValue(order);

      // The only pending garment, so it settles the 2000 balance.
      await deliverPiece("SDS-001", "p1", cash(2000), "2026-08-20");

      const [, status, extra] = updateStatus.mock.calls[0];
      expect(status).toBe("delivered");
      expect(extra.deliveredOn).toBe("2026-08-20");
    });

    it("an earlier piece leaves the order's date alone", async () => {
      findById.mockResolvedValue(splitOrder());
      updateStatus.mockResolvedValue(order);

      await deliverPiece("SDS-001", "p1", undefined, "2026-08-20");

      expect(updateStatus.mock.calls[0][2].deliveredOn).toBeUndefined();
    });

    it("startAlteration takes the day it came back in", async () => {
      findById.mockResolvedValue({ ...order, status: "delivered", alterations: [] });
      update.mockResolvedValue(order);

      await startAlteration("SDS-001", { reason: "x", promisedAt: "2026-09-05", receivedAt: "2026-08-20" });

      expect(update.mock.calls[0][1].alterations[0].receivedAt).toBe("2026-08-20");
    });

    it("completeAlteration and redeliverAlteration take their day", async () => {
      findById.mockResolvedValue({ ...order, status: "delivered", alterations: [alteration()] });
      update.mockResolvedValue(order);
      await completeAlteration("SDS-001", "2026-08-21");
      expect(update.mock.calls[0][1].alterations[0].completedAt).toBe("2026-08-21");

      update.mockClear();
      findById.mockResolvedValue({
        ...order,
        status: "delivered",
        alterations: [alteration({ completedAt: "2026-08-21" })],
      });
      await redeliverAlteration("SDS-001", "2026-08-22");
      expect(update.mock.calls[0][1].alterations[0].redeliveredAt).toBe("2026-08-22");
    });

    it("every one of them refuses a future date", async () => {
      findById.mockResolvedValue({ ...order, status: "delivered", alterations: [alteration()] });
      await expect(completeAlteration("SDS-001", "2099-01-01")).rejects.toThrow("is in the future");

      findById.mockResolvedValue({
        ...order, status: "delivered", alterations: [alteration({ completedAt: "2026-08-21" })],
      });
      await expect(redeliverAlteration("SDS-001", "2099-01-01")).rejects.toThrow("is in the future");

      findById.mockResolvedValue({ ...order, status: "delivered", alterations: [] });
      await expect(
        startAlteration("SDS-001", { reason: "", promisedAt: "2026-09-05", receivedAt: "2099-01-01" })
      ).rejects.toThrow("is in the future");

      findById.mockResolvedValue({ ...order, amount: 1000, advance: 0, finalPayment: 0 });
      await expect(deliverOrder("SDS-001", cash(1000), "2099-01-01")).rejects.toThrow("is in the future");
    });

    it("defaults to today when the date is left out", async () => {
      findById.mockResolvedValue({ ...order, status: "delivered", alterations: [alteration()] });
      update.mockResolvedValue(order);
      await completeAlteration("SDS-001");
      expect(update.mock.calls[0][1].alterations[0].completedAt).toMatch(ISO);
    });
  });

  describe("a split advance", () => {
    it("stores the split and clears the single method", async () => {
      nextOrderId.mockResolvedValue("B2601");
      create.mockResolvedValue({ ...order, publicToken: "tok" });

      await createOrder(
        { ...orderInput, advance: 1000, advanceMethod: "cash", advanceSplit: { cash: 600, upi: 400 } },
        photosForm()
      );

      const written = create.mock.calls[0][0];
      expect(written.advanceSplit).toEqual({ cash: 600, upi: 400 });
      // No single method describes it, and leaving "cash" there would be a
      // false record of the ₹400 that arrived by UPI.
      expect(written.advanceMethod).toBeNull();
    });

    it("keeps a single-method advance on advanceMethod, with no split", async () => {
      nextOrderId.mockResolvedValue("B2601");
      create.mockResolvedValue({ ...order, publicToken: "tok" });

      await createOrder(
        { ...orderInput, advance: 1000, advanceMethod: "upi", advanceSplit: { cash: 0, upi: 1000 } },
        photosForm()
      );

      const written = create.mock.calls[0][0];
      expect(written.advanceSplit).toBeNull();
      expect(written.advanceMethod).toBe("upi");
    });

    it("refuses a split that doesn't add up to the advance", async () => {
      nextOrderId.mockResolvedValue("B2601");
      await expect(
        createOrder(
          { ...orderInput, advance: 1000, advanceSplit: { cash: 600, upi: 100 } },
          photosForm()
        )
      ).rejects.toThrow("doesn't add up");
      expect(create).not.toHaveBeenCalled();
    });

    it("refuses a negative side", async () => {
      nextOrderId.mockResolvedValue("B2601");
      await expect(
        createOrder(
          { ...orderInput, advance: 1000, advanceSplit: { cash: 1100, upi: -100 } },
          photosForm()
        )
      ).rejects.toThrow("valid advance amount");
    });

    it("updateOrder corrects a split advance and clears the method", async () => {
      findById.mockResolvedValue({ ...order, advance: 1000 });
      update.mockResolvedValue(order);

      await updateOrder("SDS-001", { advanceSplit: { cash: 700, upi: 300 } });

      const patch = update.mock.calls[0][1];
      expect(patch.advanceSplit).toEqual({ cash: 700, upi: 300 });
      expect(patch.advanceMethod).toBeNull();
    });

    it("updateOrder refuses a corrected split that doesn't add up", async () => {
      findById.mockResolvedValue({ ...order, advance: 1000 });
      await expect(
        updateOrder("SDS-001", { advanceSplit: { cash: 700, upi: 100 } })
      ).rejects.toThrow("doesn't add up");
      expect(update).not.toHaveBeenCalled();
    });

    // The split is checked against the advance being set in the same edit,
    // not the one already stored.
    it("updateOrder checks the split against a changed advance", async () => {
      findById.mockResolvedValue({ ...order, advance: 1000 });
      update.mockResolvedValue(order);

      await updateOrder("SDS-001", { advance: 500, advanceSplit: { cash: 200, upi: 300 } });

      expect(update.mock.calls[0][1].advanceSplit).toEqual({ cash: 200, upi: 300 });
    });
  });

  describe("a split collection at delivery", () => {
    it("writes one ledger entry per method, sharing the hand-over", async () => {
      findById.mockResolvedValue({ ...order, amount: 1000, advance: 0, finalPayment: 0 });
      updateStatus.mockResolvedValue(order);

      await deliverOrder("SDS-001", { cash: 600, upi: 400 }, "2026-08-20");

      const extra = updateStatus.mock.calls[0][2];
      expect(extra.finalPayment).toBe(1000);
      expect(extra.finalPaymentMethod).toBeNull();
      expect(extra.payments).toEqual([
        expect.objectContaining({ amount: 600, method: "cash", at: "2026-08-20", pieceId: null }),
        expect.objectContaining({ amount: 400, method: "upi", at: "2026-08-20", pieceId: null }),
      ]);
    });

    it("refuses a split that doesn't settle the balance", async () => {
      findById.mockResolvedValue({ ...order, amount: 1000, advance: 0, finalPayment: 0 });
      await expect(deliverOrder("SDS-001", { cash: 600, upi: 100 })).rejects.toThrow("don't add up");
      expect(updateStatus).not.toHaveBeenCalled();
    });

    it("records nothing at all when there is nothing to collect", async () => {
      findById.mockResolvedValue({ ...order, amount: 1000, advance: 1000, finalPayment: 0 });
      updateStatus.mockResolvedValue(order);

      await deliverOrder("SDS-001", { cash: 0, upi: 0 });

      const extra = updateStatus.mock.calls[0][2];
      expect(extra.payments).toBeUndefined();
      expect(extra.finalPaymentMethod).toBeUndefined();
    });
  });


  // ── Authorization ─────────────────────────────────────────────────────
  // The queue pages narrow correctly, but a client reaches the action, not
  // the page — so the action is where scoping has to happen.
  describe("what each role may read", () => {
    function asRole(role: "admin" | "master" | "tailor", staffId = "s1") {
      vi.mocked(requireRole).mockResolvedValue({
        staffId,
        username: "u",
        role,
        name: "N",
      } as never);
    }

    it("gives an admin the filter it asked for", async () => {
      asRole("admin");
      list.mockResolvedValue([]);
      await getOrders({ statuses: ["ready"] });
      expect(list).toHaveBeenCalledWith({ statuses: ["ready"] });
    });

    it.each([
      ["master" as const, "masterId"],
      ["tailor" as const, "tailorId"],
    ])("pins a %s to their own assignments however they ask", async (role, key) => {
      asRole(role, "me");
      list.mockResolvedValue([]);

      // An unfiltered call would otherwise return the whole order book.
      await getOrders({});
      expect(list).toHaveBeenCalledWith({ [key]: "me" });

      // …and one naming someone else cannot override it.
      await getOrders({ [key]: "someone-else" });
      expect(list).toHaveBeenLastCalledWith({ [key]: "me" });
    });

    it("lets an admin open any order", async () => {
      asRole("admin");
      findById.mockResolvedValue({ ...order, master: null, tailor: null });
      await expect(getOrder("SDS-001")).resolves.not.toBeNull();
    });

    it("hides an order a master or tailor isn't assigned to", async () => {
      findById.mockResolvedValue({
        ...order,
        master: { id: "other", name: "Other" },
        tailor: { id: "other", name: "Other" },
      });

      asRole("master", "me");
      await expect(getOrder("SDS-001")).resolves.toBeNull();

      asRole("tailor", "me");
      await expect(getOrder("SDS-001")).resolves.toBeNull();
    });

    it("shows an order they are assigned to", async () => {
      findById.mockResolvedValue({ ...order, master: { id: "me", name: "Me" }, tailor: null });
      asRole("master", "me");
      await expect(getOrder("SDS-001")).resolves.not.toBeNull();
    });

    it("returns null for a missing order whatever the role", async () => {
      asRole("tailor", "me");
      findById.mockResolvedValue(null);
      await expect(getOrder("nope")).resolves.toBeNull();
    });
  });

  describe("money and id validation", () => {
    it.each([
      [{ amount: -1 }, "valid total amount"],
      [{ advance: -5 }, "valid advance amount"],
      [{ amount: Number.NaN }, "valid total amount"],
      [{ advance: 5000, amount: 1000 }, "more than the order total"],
    ])("createOrder refuses %o", async (over, message) => {
      nextOrderId.mockResolvedValue("B2601");
      await expect(createOrder({ ...orderInput, ...over }, photosForm())).rejects.toThrow(message);
      expect(create).not.toHaveBeenCalled();
    });

    // The storage deletes interpolate the id, so it has to be one the
    // database knows rather than anything a caller cares to send.
    it("deleteOrder refuses an id the database doesn't hold", async () => {
      findById.mockResolvedValue(null);
      await expect(deleteOrder("../../elsewhere")).rejects.toThrow("Order not found");
      expect(deleteFn).not.toHaveBeenCalled();
      expect(storageDelete).not.toHaveBeenCalled();
    });
  });

});
