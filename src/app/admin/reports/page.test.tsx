import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminReportsPage from "./page";
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
  pieces: null,
  alterations: [],
  payments: [],
  createdAt: "2026-06-01",
};

describe("AdminReportsPage", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    vi.mocked(getOrders).mockReset();
    vi.mocked(getOrders).mockResolvedValue([order]);
  });

  it("requires an admin session and renders reports for the fetched orders", async () => {
    render(await AdminReportsPage());
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(getOrders).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
  });
});
