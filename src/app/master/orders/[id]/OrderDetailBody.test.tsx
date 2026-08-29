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
    deliveredOn: null,
    pieces: null,
    alterations: [],
    payments: [],
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

  it("renders the reference photos when present", () => {
    render(<OrderDetailBody order={order({ status: "new", referenceImageUrls: ["data:image/png;base64,ref"] })} />);
    expect(screen.getByAltText("Reference 1")).toHaveAttribute("src", "data:image/png;base64,ref");
  });

  it("shows a placeholder when there are no reference photos", () => {
    render(<OrderDetailBody order={order({ status: "new", referenceImageUrls: [] })} />);
    expect(screen.getByText("No reference photos")).toBeInTheDocument();
  });

  it("renders the material photos after the dress card and before measurements", () => {
    render(<OrderDetailBody order={order({ status: "new", materialImageUrls: ["data:image/png;base64,fabric"] })} />);
    expect(screen.getByAltText("Material 1")).toHaveAttribute("src", "data:image/png;base64,fabric");

    const photos = screen.getByText("Material photos");
    const measurements = screen.getByText("Measurements");
    expect(photos.compareDocumentPosition(measurements) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows a placeholder when there are no material photos", () => {
    render(<OrderDetailBody order={order({ status: "new", materialImageUrls: [] })} />);
    expect(screen.getByText("No material photos")).toBeInTheDocument();
  });

  it("shows the cancelled state instead of the mark-done button when the order is cancelled", () => {
    render(<OrderDetailBody order={order({ status: "cancelled" })} />);
    expect(screen.getByText("Order cancelled")).toBeInTheDocument();
    expect(screen.queryByText("✓ Mark Cutting Done")).not.toBeInTheDocument();
    expect(screen.queryByText("Cutting marked done")).not.toBeInTheDocument();
  });

  it("navigates to the master queue (fresh, not a cached back-nav) when the top bar back button is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<OrderDetailBody order={order({ status: "new" })} />);
    await user.click(container.querySelector(".rounded-full")!);
    expect(mockRouter.push).toHaveBeenCalledWith("/master/queue");
  });

  it("shows an error toast and keeps the action usable when marking done fails", async () => {
    vi.mocked(updateOrderStatus).mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<OrderDetailBody order={order({ status: "cutting" })} />);

    await user.click(screen.getByText("✓ Mark Cutting Done"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the change");
    expect(screen.getByText("✓ Mark Cutting Done")).not.toBeDisabled();

    // Tapping the toast dismisses it.
    await user.click(screen.getByRole("alert"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
