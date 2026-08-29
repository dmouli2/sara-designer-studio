import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import EditOrderPage from "./page";
import { requireRole } from "@/lib/dal";
import { getOrder } from "@/app/actions/orders";
import type { Order } from "@/types";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/app/actions/orders", () => ({ getOrder: vi.fn(), updateOrder: vi.fn() }));

const order: Order = {
  id: "AD1",
  customer: "Priya Sharma",
  phone: "9876543210",
  dress: "Blouse",
  material: "Silk (shop)",
  status: "new",
  amount: 4200,
  advance: 1000,
  advanceMethod: null,
  finalPayment: 0,
  finalPaymentMethod: null,
  due: "2026-07-10",
  master: null,
  tailor: null,
  measurements: {
    type: "blouse",
    length: "", shoulder: "", hs: "", sl: "", mlos: "", tlos: "", ahs: "",
    bust: "", ub: "", waist: "", fnNr: "", bn: "", dart: "", dbd: "", p: "",
    sareeFall: "", piko: "",
  },
  lineItems: [{ particulars: "Blouse", qty: 1, amount: 3800 }],
  notes: "",
  sketchDataUrl: null,
  referenceImageUrls: [],
  materialImageUrls: ["https://storage.example/material-1.jpg"],
  mainMaterialImageUrl: "https://storage.example/material-1.jpg",
  cancellationCharge: null,
  deliveredOn: null,
  pieces: null,
  alterations: [],
  payments: [],
  createdAt: "2026-06-24",
};

describe("EditOrderPage", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    vi.mocked(getOrder).mockReset();
  });

  it("requires an admin session and renders the edit form for an editable order", async () => {
    vi.mocked(getOrder).mockResolvedValue(order);
    render(await EditOrderPage({ params: Promise.resolve({ id: "AD1" }) }));

    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(getOrder).toHaveBeenCalledWith("AD1");
    expect(screen.getByText("Edit AD1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Priya Sharma")).toBeInTheDocument();
  });

  it("shows 'Order not found' for an unknown id", async () => {
    vi.mocked(getOrder).mockResolvedValue(null);
    render(await EditOrderPage({ params: Promise.resolve({ id: "missing" }) }));
    expect(screen.getByText("Order not found")).toBeInTheDocument();
  });

  it.each(["delivered", "cancelled"] as const)(
    "redirects a %s order back to its read-only detail page",
    async (status) => {
      vi.mocked(getOrder).mockResolvedValue({ ...order, status });
      await expect(EditOrderPage({ params: Promise.resolve({ id: "AD1" }) })).rejects.toThrow(
        "NEXT_REDIRECT:/admin/orders/AD1"
      );
    }
  );
});
