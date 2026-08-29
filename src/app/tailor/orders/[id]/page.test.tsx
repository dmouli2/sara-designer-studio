import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import TailorOrderDetailPage from "./page";
import { requireRole } from "@/lib/dal";
import { getOrder } from "@/app/actions/orders";
import type { Order } from "@/types";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/app/actions/orders", () => ({ getOrder: vi.fn() }));

const order: Order = {
  id: "T1",
  customer: "Priya",
  phone: "999",
  dress: "Blouse",
  material: "Silk",
  status: "stitching",
  amount: 1000,
  advance: 0,
  advanceMethod: null,
  advanceSplit: null,
  finalPayment: 0,
  finalPaymentMethod: null,
  due: "2026-07-10",
  master: null,
  tailor: null,
  measurements: { type: "generic", bust: "", waist: "", hip: "", length: "", shoulder: "", sleeve: "", neckDepth: "", armRound: "" },
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

describe("TailorOrderDetailPage", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "t1", username: "anitha", role: "tailor", name: "Anitha K." });
    vi.mocked(getOrder).mockReset();
  });

  it("requires a tailor session and renders the order body when found", async () => {
    vi.mocked(getOrder).mockResolvedValue(order);
    render(await TailorOrderDetailPage({ params: Promise.resolve({ id: "T1" }) }));
    expect(requireRole).toHaveBeenCalledWith(["tailor"]);
    expect(getOrder).toHaveBeenCalledWith("T1");
    expect(screen.getByText("T1 · Priya")).toBeInTheDocument();
  });

  it("shows 'Order not found' for an unknown id", async () => {
    vi.mocked(getOrder).mockResolvedValue(null);
    render(await TailorOrderDetailPage({ params: Promise.resolve({ id: "missing" }) }));
    expect(screen.getByText("Order not found")).toBeInTheDocument();
  });
});
