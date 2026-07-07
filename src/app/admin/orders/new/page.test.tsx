import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import NewOrderPage from "./page";
import { requireRole } from "@/lib/dal";
import { getFabrics } from "@/app/actions/fabrics";
import { getDraft, getDrafts } from "@/app/actions/drafts";
import type { SlipExtraction } from "@/types";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/app/actions/orders", () => ({ createOrder: vi.fn() }));
vi.mock("@/app/actions/drafts", () => ({
  getDraft: vi.fn(),
  getDrafts: vi.fn(),
  confirmDraft: vi.fn(),
}));
vi.mock("@/app/actions/fabrics", () => ({
  getFabrics: vi.fn(),
  createFabric: vi.fn(),
  updateFabric: vi.fn(),
  deleteFabric: vi.fn(),
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

function params(draft?: string) {
  return { searchParams: Promise.resolve(draft ? { draft } : {}) };
}

describe("NewOrderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    vi.mocked(getFabrics).mockResolvedValue([{ id: "f1", name: "Silk", price: 350 }]);
    vi.mocked(getDrafts).mockResolvedValue([]);
    vi.mocked(getDraft).mockResolvedValue(null);
  });

  it("requires an admin session, loads fabrics, and renders the wizard", async () => {
    render(await NewOrderPage(params()));
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(getFabrics).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Choose order type")).toBeInTheDocument();
    expect(screen.getByText("Scan order slip")).toBeInTheDocument();
  });

  it("shows the pending drafts shortcut when drafts are waiting", async () => {
    vi.mocked(getDrafts).mockResolvedValue([
      { id: "d1" } as never,
      { id: "d2" } as never,
    ]);
    render(await NewOrderPage(params()));
    expect(screen.getByText(/2 scanned drafts waiting/)).toBeInTheDocument();
  });

  it("prefills the wizard from a pending draft via ?draft=", async () => {
    vi.mocked(getDraft).mockResolvedValue({
      id: "d1",
      dress: "Blouse",
      scanImagePath: "drafts/d1/scan-1.jpg",
      scanImageUrl: "https://signed/scan.jpg",
      extraction,
      warnings: ["check phone"],
      status: "draft",
      confirmedOrderId: null,
      createdAt: "2026-07-06T00:00:00.000Z",
    });

    render(await NewOrderPage(params("d1")));

    expect(getDraft).toHaveBeenCalledWith("d1");
    // Prefilled straight into step 1 with the extracted customer
    expect(screen.getByDisplayValue("Vaishnavi")).toBeInTheDocument();
    expect(screen.getByText("View scanned slip", { exact: false })).toBeInTheDocument();
    // Verifying a scan doesn't query the pending-drafts count
    expect(getDrafts).not.toHaveBeenCalled();
  });

  it("redirects a stale link for a confirmed draft to the placed order", async () => {
    vi.mocked(getDraft).mockResolvedValue({
      id: "d1",
      dress: "Blouse",
      scanImagePath: "drafts/d1/scan-1.jpg",
      scanImageUrl: null,
      extraction,
      warnings: [],
      status: "confirmed",
      confirmedOrderId: "B2401",
      createdAt: "2026-07-06T00:00:00.000Z",
    });

    await expect(NewOrderPage(params("d1"))).rejects.toThrow(
      "NEXT_REDIRECT:/admin/orders/B2401"
    );
  });

  it("falls back to the manual wizard when the draft is gone", async () => {
    vi.mocked(getDraft).mockResolvedValue(null);

    render(await NewOrderPage(params("d1")));

    expect(screen.getByText("Choose order type")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Vaishnavi")).not.toBeInTheDocument();
  });

  it("falls back to the manual wizard for a discarded draft with no order", async () => {
    vi.mocked(getDraft).mockResolvedValue({
      id: "d1",
      dress: "Blouse",
      scanImagePath: "drafts/d1/scan-1.jpg",
      scanImageUrl: null,
      extraction,
      warnings: [],
      status: "discarded",
      confirmedOrderId: null,
      createdAt: "2026-07-06T00:00:00.000Z",
    });

    render(await NewOrderPage(params("d1")));

    expect(screen.getByText("Choose order type")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Vaishnavi")).not.toBeInTheDocument();
  });
});
