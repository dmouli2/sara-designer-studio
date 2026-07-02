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
    id: "T1",
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
    referenceImageUrls: [],
    cancellationCharge: null,
    createdAt: "2026-06-01",
    ...overrides,
  };
}

describe("OrderDetailBody", () => {
  beforeEach(() => {
    vi.mocked(updateOrderStatus).mockReset();
    vi.mocked(updateOrderStatus).mockResolvedValue(order({ status: "stitching" }));
  });

  it("shows the style notes when present", () => {
    render(<OrderDetailBody order={order({ status: "stitching", notes: "Boat neck, gold border" })} />);
    expect(screen.getByText('"Boat neck, gold border"')).toBeInTheDocument();
  });

  it("shows status-update buttons while the order is in progress", () => {
    render(<OrderDetailBody order={order({ status: "cutting_done" })} />);
    expect(screen.getByText("In Progress — Stitching")).toBeInTheDocument();
    expect(screen.getByText("Mark as Ready")).toBeInTheDocument();
  });

  it("highlights the current status among the buttons", () => {
    render(<OrderDetailBody order={order({ status: "stitching" })} />);
    const btn = screen.getByText("In Progress — Stitching").closest("button")!;
    expect(btn).toHaveClass("bg-[#0F0F0F]");
  });

  it("updates the order status and reflects the new status immediately from the action's response", async () => {
    vi.mocked(updateOrderStatus).mockResolvedValue(order({ status: "ready" }));
    const user = userEvent.setup();
    render(<OrderDetailBody order={order({ status: "cutting_done" })} />);
    await user.click(screen.getByText("Mark as Ready"));
    expect(updateOrderStatus).toHaveBeenCalledWith("T1", "ready");
    expect(await screen.findByText("Order is ready for pickup!")).toBeInTheDocument();
  });

  it("shows the ready-for-pickup message once status is ready", () => {
    render(<OrderDetailBody order={order({ status: "ready" })} />);
    expect(screen.getByText("Order is ready for pickup!")).toBeInTheDocument();
    expect(screen.queryByText("Mark as Ready")).not.toBeInTheDocument();
  });

  it("also hides status buttons once delivered", () => {
    render(<OrderDetailBody order={order({ status: "delivered" })} />);
    expect(screen.getByText("Order is ready for pickup!")).toBeInTheDocument();
  });

  it("renders the sketch image when present", () => {
    render(<OrderDetailBody order={order({ status: "stitching", sketchDataUrl: "data:image/png;base64,sketch" })} />);
    expect(screen.getByAltText("Sketch")).toHaveAttribute("src", "data:image/png;base64,sketch");
  });

  it("renders a placeholder when there are no reference photos", () => {
    render(<OrderDetailBody order={order({ status: "stitching", referenceImageUrls: [] })} />);
    expect(screen.getByText("No reference photos")).toBeInTheDocument();
  });

  it("renders the reference photos when present", () => {
    render(<OrderDetailBody order={order({ status: "stitching", referenceImageUrls: ["data:image/png;base64,ref"] })} />);
    expect(screen.getByAltText("Reference 1")).toHaveAttribute("src", "data:image/png;base64,ref");
  });

  it("navigates to the tailor queue (fresh, not a cached back-nav) when the top bar back button is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<OrderDetailBody order={order({ status: "stitching" })} />);
    await user.click(container.querySelector(".rounded-full")!);
    expect(mockRouter.push).toHaveBeenCalledWith("/tailor/queue");
  });

  it("shows the cancelled state instead of status-update buttons when the order is cancelled", () => {
    render(<OrderDetailBody order={order({ status: "cancelled" })} />);
    expect(screen.getByText("Order cancelled")).toBeInTheDocument();
    expect(screen.queryByText("In Progress — Stitching")).not.toBeInTheDocument();
    expect(screen.queryByText("Order is ready for pickup!")).not.toBeInTheDocument();
  });
});
