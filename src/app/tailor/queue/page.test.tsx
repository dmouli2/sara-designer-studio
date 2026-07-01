import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TailorQueuePage from "./page";
import { requireRole } from "@/lib/dal";
import { getOrders } from "@/app/actions/orders";
import type { Order } from "@/types";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/app/actions/orders", () => ({ getOrders: vi.fn() }));

function order(overrides: Partial<Order>): Order {
  return {
    id: "B1",
    customer: "Priya",
    phone: "999",
    dress: "Blouse",
    material: "Silk",
    status: "stitching",
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
    ...overrides,
  };
}

describe("TailorQueuePage", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "t1", username: "anitha", role: "tailor", name: "Anitha K." });
    vi.mocked(getOrders).mockReset();
  });

  it("requires a tailor session and filters to orders assigned to this tailor", async () => {
    const user = userEvent.setup();
    const orders: Order[] = [
      order({ id: "B1", tailor: { id: "t1", name: "Anitha K." }, status: "stitching" }),
      order({ id: "B2", tailor: { id: "t1", name: "Anitha K." }, status: "ready" }),
      order({ id: "B3", tailor: { id: "t2", name: "Suma M." }, status: "stitching" }),
      order({ id: "B4", tailor: { id: "t1", name: "Anitha K." }, status: "delivered" }),
    ];
    vi.mocked(getOrders).mockResolvedValue(orders);

    render(await TailorQueuePage());

    expect(requireRole).toHaveBeenCalledWith(["tailor"]);
    expect(screen.getByText("B1")).toBeInTheDocument();
    expect(screen.queryByText("B2")).not.toBeInTheDocument();
    expect(screen.queryByText("B3")).not.toBeInTheDocument();
    expect(screen.queryByText("B4")).not.toBeInTheDocument();

    await user.click(screen.getByText("Done"));
    expect(screen.getByText("B2")).toBeInTheDocument();
  });

  it("shows an empty state when there are no assigned jobs", async () => {
    vi.mocked(getOrders).mockResolvedValue([]);
    render(await TailorQueuePage());
    expect(screen.getByText("No jobs assigned yet")).toBeInTheDocument();
  });
});
