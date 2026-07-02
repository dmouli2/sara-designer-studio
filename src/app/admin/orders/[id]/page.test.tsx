import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminOrderDetailPage from "./page";
import { requireRole } from "@/lib/dal";
import { getOrder } from "@/app/actions/orders";
import { listStaff } from "@/app/actions/staff";
import type { Order } from "@/types";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/app/actions/orders", () => ({ getOrder: vi.fn() }));
vi.mock("@/app/actions/staff", () => ({ listStaff: vi.fn() }));

const order: Order = {
  id: "AD1",
  customer: "Priya Sharma",
  phone: "999",
  dress: "Blouse",
  material: "Silk",
  status: "new",
  amount: 4200,
  advance: 1000,
  due: "2026-07-10",
  master: null,
  tailor: null,
  measurements: { type: "generic", bust: "", waist: "", hip: "", length: "", shoulder: "", sleeve: "", neckDepth: "", armRound: "" },
  lineItems: [],
  notes: "",
  sketchDataUrl: null,
  referenceImageUrls: [],
  cancellationCharge: null,
  createdAt: "2026-06-24",
};

describe("AdminOrderDetailPage", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    vi.mocked(getOrder).mockReset();
    vi.mocked(listStaff).mockReset();
    vi.mocked(listStaff).mockResolvedValue([]);
  });

  it("requires an admin session and renders the order body when found", async () => {
    vi.mocked(getOrder).mockResolvedValue(order);
    render(await AdminOrderDetailPage({ params: Promise.resolve({ id: "AD1" }) }));

    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(getOrder).toHaveBeenCalledWith("AD1");
    expect(listStaff).toHaveBeenCalledWith({ role: "master", activeOnly: true });
    expect(listStaff).toHaveBeenCalledWith({ role: "tailor", activeOnly: true });
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
  });

  it("shows 'Order not found' for an unknown id", async () => {
    vi.mocked(getOrder).mockResolvedValue(null);
    render(await AdminOrderDetailPage({ params: Promise.resolve({ id: "missing" }) }));
    expect(screen.getByText("Order not found")).toBeInTheDocument();
  });
});
