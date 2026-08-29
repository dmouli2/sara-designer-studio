import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import TrackOrderPage from "./page";
import { getPublicOrder } from "@/app/actions/publicOrders";
import type { PublicOrder } from "@/lib/db";

vi.mock("@/app/actions/publicOrders", () => ({ getPublicOrder: vi.fn() }));

const publicOrder: PublicOrder = {
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
  lineItems: [],
  notes: "",
  sketchDataUrl: null,
  referenceImageUrls: [],
  materialImageUrls: [],
  mainMaterialImageUrl: null,
  cancellationCharge: null,
  deliveredOn: null,
  pieces: null,
  alterations: [],
  payments: [],
  createdAt: "2026-06-01",
};

describe("TrackOrderPage", () => {
  beforeEach(() => {
    vi.mocked(getPublicOrder).mockReset();
  });

  it("looks up the order by its public token and renders the read-only body", async () => {
    vi.mocked(getPublicOrder).mockResolvedValue(publicOrder);
    render(await TrackOrderPage({ params: Promise.resolve({ token: "tok-abc123" }) }));

    expect(getPublicOrder).toHaveBeenCalledWith("tok-abc123");
    expect(screen.getByText("Order SDS-001")).toBeInTheDocument();
  });

  it("triggers a not-found response for an unknown or invalid token", async () => {
    vi.mocked(getPublicOrder).mockResolvedValue(null);
    await expect(TrackOrderPage({ params: Promise.resolve({ token: "bad-token" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
  });
});
