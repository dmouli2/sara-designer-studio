import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MasterOrderDetailPage from "./page";
import { requireRole } from "@/lib/dal";
import { getOrder } from "@/app/actions/orders";
import type { Order } from "@/types";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/app/actions/orders", () => ({ getOrder: vi.fn() }));

const order: Order = {
  id: "M1",
  customer: "Priya",
  phone: "999",
  dress: "Blouse",
  material: "Silk",
  status: "new",
  amount: 1000,
  advance: 0,
  due: "2026-07-10",
  master: null,
  tailor: null,
  measurements: { type: "generic", bust: "", waist: "", hip: "", length: "", shoulder: "", sleeve: "", neckDepth: "", armRound: "" },
  lineItems: [],
  notes: "",
  sketchDataUrl: null,
  referenceImageUrl: null,
  createdAt: "2026-06-01",
};

describe("MasterOrderDetailPage", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "m1", username: "ramesh", role: "master", name: "Ramesh K." });
    vi.mocked(getOrder).mockReset();
  });

  it("requires a master session and renders the order body when found", async () => {
    vi.mocked(getOrder).mockResolvedValue(order);
    render(await MasterOrderDetailPage({ params: Promise.resolve({ id: "M1" }) }));
    expect(requireRole).toHaveBeenCalledWith(["master"]);
    expect(getOrder).toHaveBeenCalledWith("M1");
    expect(screen.getByText("M1 · Priya")).toBeInTheDocument();
  });

  it("shows 'Order not found' for an unknown id", async () => {
    vi.mocked(getOrder).mockResolvedValue(null);
    render(await MasterOrderDetailPage({ params: Promise.resolve({ id: "missing" }) }));
    expect(screen.getByText("Order not found")).toBeInTheDocument();
  });
});
