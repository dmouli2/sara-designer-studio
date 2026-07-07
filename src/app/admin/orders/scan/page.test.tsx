import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ScanOrderPage, * as page from "./page";
import { requireRole } from "@/lib/dal";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/app/actions/drafts", () => ({ createDraftFromScan: vi.fn() }));

// Mutable flag so both branches of the feature gate are testable.
let scanFlag = true;
vi.mock("@/lib/features", () => ({
  get FEATURE_SCAN_ORDERS() {
    return scanFlag;
  },
}));

describe("ScanOrderPage", () => {
  beforeEach(() => {
    scanFlag = true;
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({
      staffId: "a1", username: "admin", role: "admin", name: "Admin",
    } as never);
  });

  it("requires an admin session and renders the capture screen", async () => {
    render(await ScanOrderPage());
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(screen.getByText("Scan Order Slip")).toBeInTheDocument();
    expect(screen.getByText("Read slip")).toBeInTheDocument();
  });

  it("redirects to the orders list when the feature is disabled", async () => {
    scanFlag = false;
    await expect(ScanOrderPage()).rejects.toThrow("NEXT_REDIRECT:/admin/orders");
  });

  it("sets a longer maxDuration to cover Gemini free-tier retries", () => {
    expect(page.maxDuration).toBe(60);
  });
});
