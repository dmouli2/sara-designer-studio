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
    materialImageUrls: [],
    mainMaterialImageUrl: null,
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

  it("shows the mark-stitching-done button while the order is in progress", () => {
    render(<OrderDetailBody order={order({ status: "stitching" })} />);
    expect(screen.getByText("✓ Mark Stitching Done")).toBeInTheDocument();
  });

  it("hands off to hemming & hook and reflects the new status immediately from the action's response", async () => {
    vi.mocked(updateOrderStatus).mockResolvedValue(order({ status: "hemming_hook" }));
    const user = userEvent.setup();
    render(<OrderDetailBody order={order({ status: "stitching" })} />);
    await user.click(screen.getByText("✓ Mark Stitching Done"));
    expect(updateOrderStatus).toHaveBeenCalledWith("T1", "hemming_hook");
    expect(await screen.findByText("Sent for Hemming & Hook")).toBeInTheDocument();
  });

  it("shows a hemming & hook handoff message instead of the ready message while it's pending", () => {
    render(<OrderDetailBody order={order({ status: "hemming_hook" })} />);
    expect(screen.getByText("Sent for Hemming & Hook")).toBeInTheDocument();
    expect(screen.queryByText("Order is ready for pickup!")).not.toBeInTheDocument();
    expect(screen.queryByText("✓ Mark Stitching Done")).not.toBeInTheDocument();
  });

  it("shows the ready-for-pickup message once status is ready", () => {
    render(<OrderDetailBody order={order({ status: "ready" })} />);
    expect(screen.getByText("Order is ready for pickup!")).toBeInTheDocument();
    expect(screen.queryByText("✓ Mark Stitching Done")).not.toBeInTheDocument();
  });

  it("also hides the action button once delivered", () => {
    render(<OrderDetailBody order={order({ status: "delivered" })} />);
    expect(screen.getByText("Order is ready for pickup!")).toBeInTheDocument();
  });

  it("disables the button and shows a pending label while the update is in flight", async () => {
    let resolveUpdate: (o: Order) => void = () => {};
    vi.mocked(updateOrderStatus).mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );
    const user = userEvent.setup();
    render(<OrderDetailBody order={order({ status: "stitching" })} />);

    await user.click(screen.getByText("✓ Mark Stitching Done"));
    expect(screen.getByText("Updating…")).toBeDisabled();

    resolveUpdate(order({ status: "hemming_hook" }));
    expect(await screen.findByText("Sent for Hemming & Hook")).toBeInTheDocument();
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

  it("renders the material photos at the top when present", () => {
    render(<OrderDetailBody order={order({ status: "stitching", materialImageUrls: ["data:image/png;base64,fabric"] })} />);
    expect(screen.getByAltText("Material 1")).toHaveAttribute("src", "data:image/png;base64,fabric");
  });

  it("shows a placeholder when there are no material photos", () => {
    render(<OrderDetailBody order={order({ status: "stitching", materialImageUrls: [] })} />);
    expect(screen.getByText("No material photos")).toBeInTheDocument();
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

  it("shows an error toast and keeps the action usable when the handoff fails", async () => {
    vi.mocked(updateOrderStatus).mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<OrderDetailBody order={order({ status: "stitching" })} />);

    await user.click(screen.getByText("✓ Mark Stitching Done"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the change");
    expect(screen.getByText("✓ Mark Stitching Done")).not.toBeDisabled();
  });
});
