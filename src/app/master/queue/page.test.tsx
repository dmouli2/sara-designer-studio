import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MasterQueuePage from "./page";
import { requireRole } from "@/lib/dal";
import { getOrders } from "@/app/actions/orders";
import type { Order } from "@/types";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/app/actions/orders", () => ({ getOrders: vi.fn() }));

function order(overrides: Partial<Order>): Order {
  return {
    id: "A1",
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
    referenceImageUrls: [],
    cancellationCharge: null,
    createdAt: "2026-06-01",
    ...overrides,
  };
}

describe("MasterQueuePage", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "m1", username: "ramesh", role: "master", name: "Ramesh K." });
    vi.mocked(getOrders).mockReset();
  });

  it("requests only this master's active-stage orders and splits them across the tabs", async () => {
    const user = userEvent.setup();
    // What the DB-side filter (masterId + statuses) would return.
    const orders: Order[] = [
      order({ id: "A1", master: { id: "m1", name: "Ramesh K." }, status: "new" }),
      order({ id: "A2", master: { id: "m1", name: "Ramesh K." }, status: "cutting" }),
      order({ id: "A3", master: { id: "m1", name: "Ramesh K." }, status: "cutting_done" }),
    ];
    vi.mocked(getOrders).mockResolvedValue(orders);

    render(await MasterQueuePage());

    expect(requireRole).toHaveBeenCalledWith(["master"]);
    expect(getOrders).toHaveBeenCalledWith({
      masterId: "m1",
      statuses: ["new", "cutting", "cutting_done"],
    });
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText("A2")).toBeInTheDocument();
    expect(screen.queryByText("A3")).not.toBeInTheDocument();

    await user.click(screen.getByText("Completed"));
    expect(screen.getByText("A3")).toBeInTheDocument();
  });

  it("shows an empty state when there are no assigned orders", async () => {
    vi.mocked(getOrders).mockResolvedValue([]);
    render(await MasterQueuePage());
    expect(screen.getByText("No orders assigned yet")).toBeInTheDocument();
  });
});
