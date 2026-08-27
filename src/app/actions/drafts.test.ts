import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireRole } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";
import { getSlipExtractor } from "@/lib/extraction";
import { UserFacingError } from "@/lib/errors";
import {
  createDraftFromScan,
  getDrafts,
  getDraft,
  discardDraft,
  confirmDraft,
} from "./drafts";
import { mockRefresh, mockRevalidatePath } from "../../../vitest.setup";
import type { DraftOrder } from "@/lib/db";
import type { SlipExtraction } from "@/types";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/storage", () => ({ getImageStorage: vi.fn() }));
vi.mock("@/lib/extraction", () => ({ getSlipExtractor: vi.fn() }));

const extraction: SlipExtraction = {
  bookType: "Blouse",
  bookTypeConfidence: "high",
  billNo: "2392",
  date: "25/6",
  dueDate: "",
  customerName: "Vaishnavi",
  customerNameConfidence: "high",
  phone: "9876543210",
  phoneConfidence: "high",
  measurements: [],
  lineItems: [{ particulars: "Blouse", qty: 1, amount: 400, confidence: "high" }],
  advance: "",
  advanceConfidence: "high",
  writtenTotal: "400",
  writtenTotalConfidence: "high",
  extraNotes: [],
};

const draft: DraftOrder = {
  id: "d1",
  dress: "Blouse",
  scanImagePath: "drafts/d1/scan-1.jpg",
  extraction,
  warnings: [],
  status: "draft",
  confirmedOrderId: null,
  createdAt: "2026-07-06T00:00:00.000Z",
};

function scanForm(file: File | string = new File(["page"], "scan.jpg", { type: "image/jpeg" })): FormData {
  const photos = new FormData();
  photos.append("scan", file);
  return photos;
}

describe("drafts actions", () => {
  const list = vi.fn();
  const findById = vi.fn();
  const create = vi.fn();
  const updateStatus = vi.fn();
  const deleteDraft = vi.fn();
  const upload = vi.fn();
  const getSignedUrl = vi.fn();
  const storageDelete = vi.fn();
  const extract = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({
      staffId: "s1", username: "admin", role: "admin", name: "Admin",
    } as never);
    vi.mocked(getDb).mockReturnValue({
      drafts: { list, findById, create, updateStatus, delete: deleteDraft },
    } as never);
    vi.mocked(getImageStorage).mockReturnValue({
      upload, getSignedUrl, delete: storageDelete,
    } as never);
    vi.mocked(getSlipExtractor).mockReturnValue({ extract } as never);
    upload.mockResolvedValue(undefined);
    storageDelete.mockResolvedValue(undefined);
    extract.mockResolvedValue(extraction);
    create.mockImplementation(async (input) => ({ ...draft, ...input }));
  });

  describe("createDraftFromScan", () => {
    it("extracts, uploads the scan and stores the draft with warnings", async () => {
      const result = await createDraftFromScan(scanForm());

      expect(requireRole).toHaveBeenCalledWith(["admin"]);
      expect(extract).toHaveBeenCalledWith(
        `data:image/jpeg;base64,${Buffer.from("page").toString("base64")}`
      );
      const input = create.mock.calls[0][0];
      expect(input.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(input.dress).toBe("Blouse");
      expect(input.scanImagePath).toBe(`drafts/${input.id}/scan-1.jpg`);
      expect(input.extraction).toEqual(extraction);
      expect(input.warnings).toEqual([]);
      expect(upload).toHaveBeenCalledWith(input.scanImagePath, expect.stringContaining("data:image/jpeg;base64,"));
      expect(result).toEqual({ ok: true, id: input.id });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/drafts");
      expect(mockRefresh).toHaveBeenCalled();
    });

    it("stores '' dress and the detection warning when the book type is unknown", async () => {
      extract.mockResolvedValue({ ...extraction, bookType: "unknown" });

      await createDraftFromScan(scanForm());

      const input = create.mock.calls[0][0];
      expect(input.dress).toBe("");
      expect(input.warnings[0]).toContain("Couldn't detect Blouse vs Salwar");
    });

    // Every failure comes back as data, never as a throw: Next.js replaces
    // the message of an error thrown out of a Server Action with an opaque
    // digest in production, so the admin would only ever see "An error
    // occurred in the Server Components render".
    it("reports a missing scan file without throwing", async () => {
      const result = await createDraftFromScan(new FormData());
      expect(result).toEqual({ ok: false, message: expect.stringContaining("No scan photo received") });
      expect(extract).not.toHaveBeenCalled();
    });

    it("passes a user-facing extraction failure through and uploads nothing", async () => {
      extract.mockRejectedValue(new UserFacingError("The free scanning quota is busy right now."));
      const result = await createDraftFromScan(scanForm());
      expect(result).toEqual({ ok: false, message: "The free scanning quota is busy right now." });
      expect(upload).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it("hides the message of an internal failure behind a generic one", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      extract.mockRejectedValue(new Error("supabase: connection string invalid"));

      const result = await createDraftFromScan(scanForm());

      expect(result).toEqual({
        ok: false,
        message: "Couldn't read the slip — check your connection and try again.",
      });
      // …but it is still logged for us.
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("reports a photo that isn't a slip and uploads/creates nothing", async () => {
      extract.mockResolvedValue({ ...extraction, imageProblem: "not_a_slip" });
      const result = await createDraftFromScan(scanForm());
      expect(result).toEqual({
        ok: false,
        message: expect.stringContaining("doesn't look like an order-book slip"),
      });
      expect(upload).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it("reports an unreadable photo and uploads/creates nothing", async () => {
      extract.mockResolvedValue({ ...extraction, imageProblem: "unreadable" });
      const result = await createDraftFromScan(scanForm());
      expect(result).toEqual({ ok: false, message: expect.stringContaining("too blurry or dark") });
      expect(upload).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it("cleans up the uploaded photo when the insert fails", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      create.mockRejectedValue(new Error("insert failed"));

      const result = await createDraftFromScan(scanForm());

      expect(result.ok).toBe(false);
      expect(storageDelete).toHaveBeenCalledWith(upload.mock.calls[0][0]);
      consoleError.mockRestore();
    });
  });

  describe("getDrafts / getDraft", () => {
    it("getDrafts lists pending drafts", async () => {
      list.mockResolvedValue([draft]);
      expect(await getDrafts()).toEqual([draft]);
      expect(requireRole).toHaveBeenCalledWith(["admin"]);
    });

    it("getDraft resolves the scan photo to a signed url", async () => {
      findById.mockResolvedValue(draft);
      getSignedUrl.mockResolvedValue("https://signed/scan-1.jpg");

      const result = await getDraft("d1");

      expect(getSignedUrl).toHaveBeenCalledWith("drafts/d1/scan-1.jpg");
      expect(result).toEqual({ ...draft, scanImageUrl: "https://signed/scan-1.jpg" });
    });

    it("getDraft returns null for a missing draft", async () => {
      findById.mockResolvedValue(null);
      expect(await getDraft("nope")).toBeNull();
      expect(getSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe("discardDraft", () => {
    it("deletes the row and the scan photo and revalidates", async () => {
      deleteDraft.mockResolvedValue(undefined);

      await discardDraft("d1");

      expect(deleteDraft).toHaveBeenCalledWith("d1");
      expect(storageDelete).toHaveBeenCalledWith("drafts/d1/scan-1.jpg");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/drafts");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe("confirmDraft", () => {
    it("marks the draft confirmed with the real order id and removes the scan copy", async () => {
      updateStatus.mockResolvedValue({ ...draft, status: "confirmed", confirmedOrderId: "B2401" });

      await confirmDraft("d1", "B2401");

      expect(updateStatus).toHaveBeenCalledWith("d1", "confirmed", "B2401");
      expect(storageDelete).toHaveBeenCalledWith("drafts/d1/scan-1.jpg");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/drafts");
    });

    it("requires an order id", async () => {
      await expect(confirmDraft("d1", "")).rejects.toThrow("Order id is required");
      expect(updateStatus).not.toHaveBeenCalled();
    });
  });
});
