import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrderDetailBody from "./OrderDetailBody";
import { updateOrderStatus } from "@/app/actions/orders";
import { mockRouter } from "../../../../../vitest.setup";
import type { Order } from "@/types";

vi.mock("@/app/actions/orders", () => ({
  updateOrderStatus: vi.fn(),
}));

function order(overrides: Partial<Order>): Order {
  return {
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
    ...overrides,
  };
}

describe("OrderDetailBody", () => {
  beforeEach(() => {
    vi.mocked(updateOrderStatus).mockReset();
    vi.mocked(updateOrderStatus).mockResolvedValue(order({ status: "cutting_done" }));
  });

  it("shows the style notes when present", () => {
    render(<OrderDetailBody order={order({ status: "new", notes: "Heavy embroidery border" })} />);
    expect(screen.getByText('"Heavy embroidery border"')).toBeInTheDocument();
  });

  it("shows a mark-done button for an in-progress order and marks it done immediately from the action's response", async () => {
    const user = userEvent.setup();
    render(<OrderDetailBody order={order({ status: "new" })} />);
    await user.click(screen.getByText("✓ Mark Cutting Done"));

    expect(updateOrderStatus).toHaveBeenCalledWith("M1", "cutting_done");
    expect(screen.getByText("Cutting marked done")).toBeInTheDocument();
  });

  it("shows the already-done state without a button when cutting is already done", () => {
    render(<OrderDetailBody order={order({ status: "cutting_done" })} />);
    expect(screen.getByText("Cutting marked done")).toBeInTheDocument();
    expect(screen.queryByText("✓ Mark Cutting Done")).not.toBeInTheDocument();
  });

  it("renders the sketch image when present", () => {
    render(<OrderDetailBody order={order({ status: "new", sketchDataUrl: "data:image/png;base64,sketch" })} />);
    expect(screen.getByAltText("Sketch")).toHaveAttribute("src", "data:image/png;base64,sketch");
  });

  it("renders the reference photo when present", () => {
    render(<OrderDetailBody order={order({ status: "new", referenceImageUrl: "data:image/png;base64,ref" })} />);
    expect(screen.getByAltText("Reference")).toHaveAttribute("src", "data:image/png;base64,ref");
  });

  it("shows a placeholder when there is no reference photo", () => {
    render(<OrderDetailBody order={order({ status: "new", referenceImageUrl: null })} />);
    expect(screen.getByText("No reference photo")).toBeInTheDocument();
  });

  it("navigates to the master queue (fresh, not a cached back-nav) when the top bar back button is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<OrderDetailBody order={order({ status: "new" })} />);
    await user.click(container.querySelector(".rounded-full")!);
    expect(mockRouter.push).toHaveBeenCalledWith("/master/queue");
  });
});
