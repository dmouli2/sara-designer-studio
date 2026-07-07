import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DraftsPage from "./page";
import { requireRole } from "@/lib/dal";
import { getDrafts } from "@/app/actions/drafts";
import type { DraftOrder } from "@/lib/db/types";
import type { SlipExtraction } from "@/types";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/app/actions/drafts", () => ({ getDrafts: vi.fn() }));

let scanFlag = true;
vi.mock("@/lib/features", () => ({
  get FEATURE_SCAN_ORDERS() {
    return scanFlag;
  },
}));

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
  lineItems: [],
  advance: "",
  advanceConfidence: "high",
  writtenTotal: "",
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

describe("DraftsPage", () => {
  beforeEach(() => {
    scanFlag = true;
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({
      staffId: "a1", username: "admin", role: "admin", name: "Admin",
    } as never);
    vi.mocked(getDrafts).mockReset();
    vi.mocked(getDrafts).mockResolvedValue([draft]);
  });

  it("requires an admin session and lists the pending drafts", async () => {
    render(await DraftsPage());
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(screen.getByText("Scanned Drafts")).toBeInTheDocument();
    expect(screen.getByText("Vaishnavi")).toBeInTheDocument();
  });

  it("redirects to the orders list when the feature is disabled", async () => {
    scanFlag = false;
    await expect(DraftsPage()).rejects.toThrow("NEXT_REDIRECT:/admin/orders");
    expect(getDrafts).not.toHaveBeenCalled();
  });
});
