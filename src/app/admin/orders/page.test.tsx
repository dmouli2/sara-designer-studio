import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminOrdersPage from "./page";
import { requireRole } from "@/lib/dal";
import { getOrders } from "@/app/actions/orders";
import type { Order } from "@/types";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/app/actions/orders", () => ({ getOrders: vi.fn() }));

const order: Order = {
  id: "C1",
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

describe("AdminOrdersPage", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    vi.mocked(getOrders).mockReset();
    vi.mocked(getOrders).mockResolvedValue([order]);
  });

  it("requires an admin session and renders the fetched orders", async () => {
    render(await AdminOrdersPage());
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(getOrders).toHaveBeenCalled();
    expect(screen.getByText("C1")).toBeInTheDocument();
  });

  it("requests the first page with a real numeric limit", async () => {
    // Regression: ORDERS_PAGE_SIZE was once exported from the "use client"
    // OrdersBody module — imported into this Server Component it became a
    // client-reference stub, the query range became (0, NaN), and the list
    // silently rendered empty.
    render(await AdminOrdersPage());
    const filter = vi.mocked(getOrders).mock.calls[0][0];
    expect(filter).toEqual({ limit: 200 });
    expect(typeof filter?.limit).toBe("number");
  });
});
