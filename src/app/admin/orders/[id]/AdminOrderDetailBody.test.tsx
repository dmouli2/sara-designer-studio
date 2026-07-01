import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminOrderDetailBody from "./AdminOrderDetailBody";
import { assignStaff, updateOrderStatus, deleteOrder } from "@/app/actions/orders";
import { mockRouter } from "../../../../../vitest.setup";
import type { Order } from "@/types";
import type { StaffListItem } from "@/app/actions/staff";

vi.mock("@/app/actions/orders", () => ({
  assignStaff: vi.fn(),
  updateOrderStatus: vi.fn(),
  deleteOrder: vi.fn(),
}));

const MASTERS: StaffListItem[] = [{ id: "m1", username: "ramesh", name: "Ramesh K.", role: "master", active: true }];
const TAILORS: StaffListItem[] = [{ id: "t1", username: "anitha", name: "Anitha K.", role: "tailor", active: true }];

function order(overrides: Partial<Order>): Order {
  return {
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
    referenceImageUrl: null,
    createdAt: "2026-06-24",
    ...overrides,
  };
}

function renderBody(o: Order) {
  return render(<AdminOrderDetailBody order={o} masters={MASTERS} tailors={TAILORS} />);
}

describe("AdminOrderDetailBody", () => {
  beforeEach(() => {
    vi.mocked(assignStaff).mockReset();
    vi.mocked(assignStaff).mockResolvedValue(undefined);
    vi.mocked(updateOrderStatus).mockReset();
    vi.mocked(updateOrderStatus).mockResolvedValue(undefined);
    vi.mocked(deleteOrder).mockReset();
    vi.mocked(deleteOrder).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows order details, progress and payment summary", () => {
    renderBody(order({ status: "new", amount: 4200, advance: 1000 }));
    expect(screen.getByText("Order progress")).toBeInTheDocument();
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("₹4,200")).toBeInTheDocument();
    expect(screen.getByText("₹3,200")).toBeInTheDocument(); // balance
  });

  it("shows notes and line items when present", () => {
    renderBody(
      order({
        status: "new",
        notes: "Heavy embroidery border",
        lineItems: [{ particulars: "Blouse", qty: 1, amount: 3800 }],
      })
    );
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Heavy embroidery border")).toBeInTheDocument();
    expect(screen.getByText("Blouse ×1")).toBeInTheDocument();
  });

  it("shows the balance in green when the order is fully paid", () => {
    renderBody(order({ status: "new", amount: 1800, advance: 1800 }));
    const balanceValue = screen.getByText("Balance due").parentElement!.querySelector("span:last-child")!;
    expect(balanceValue).toHaveClass("text-[#1B6B3A]");
    expect(balanceValue).toHaveTextContent("₹0");
  });

  it("hides the tailor assignment select for a brand-new order", () => {
    renderBody(order({ status: "new" }));
    expect(screen.getByText("Assign master")).toBeInTheDocument();
    expect(screen.queryByText("Assign tailor")).not.toBeInTheDocument();
  });

  it("shows the tailor assignment select once cutting has started", () => {
    renderBody(order({ status: "cutting" }));
    expect(screen.getByText("Assign tailor")).toBeInTheDocument();
  });

  it("loads the master and tailor options passed in as props", () => {
    renderBody(order({ status: "cutting" }));
    expect(screen.getByText("Ramesh K.")).toBeInTheDocument();
    expect(screen.getByText("Anitha K.")).toBeInTheDocument();
  });

  it("saves the master/tailor assignment and shows a confirmation that clears after a delay", async () => {
    vi.useFakeTimers();
    renderBody(order({ status: "stitching" }));

    fireEvent.change(screen.getByDisplayValue("Select master…"), { target: { value: "m1" } });
    fireEvent.change(screen.getByDisplayValue("Select tailor…"), { target: { value: "t1" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save Assignment"));
    });

    expect(assignStaff).toHaveBeenCalledWith("AD1", "m1", "t1");
    expect(screen.getByText("✓ Saved!")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("Save Assignment")).toBeInTheDocument();
  });

  it("saves null master/tailor when left unselected", async () => {
    const user = userEvent.setup();
    renderBody(order({ status: "new" }));
    await user.click(screen.getByText("Save Assignment"));
    expect(assignStaff).toHaveBeenCalledWith("AD1", null, null);
  });

  it("pre-selects the currently assigned master and tailor", () => {
    renderBody(order({ status: "cutting", master: { id: "m1", name: "Ramesh K." }, tailor: { id: "t1", name: "Anitha K." } }));
    expect(screen.getByDisplayValue("Ramesh K.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Anitha K.")).toBeInTheDocument();
  });

  it("shows the next status transition button and triggers it", async () => {
    const user = userEvent.setup();
    renderBody(order({ status: "new" }));
    const btn = screen.getByText("Move to Cutting →");
    await user.click(btn);
    expect(updateOrderStatus).toHaveBeenCalledWith("AD1", "cutting");
  });

  it("shows the delivered state and hides the transition button", () => {
    renderBody(order({ status: "delivered" }));
    expect(screen.getByText("Order delivered")).toBeInTheDocument();
    expect(screen.queryByText(/Mark as Delivered/)).not.toBeInTheDocument();
  });

  it("hides the transition button for statuses with no forward transition", () => {
    renderBody(order({ status: "cutting" }));
    expect(screen.queryByText(/→$/)).not.toBeInTheDocument();
  });

  it("renders the sketch and reference images when present", () => {
    renderBody(
      order({
        status: "new",
        sketchDataUrl: "data:image/png;base64,sketch",
        referenceImageUrl: "data:image/png;base64,ref",
      })
    );
    expect(screen.getByAltText("Sketch")).toHaveAttribute("src", "data:image/png;base64,sketch");
    expect(screen.getByAltText("Reference")).toHaveAttribute("src", "data:image/png;base64,ref");
  });

  it("shows a placeholder when there is no reference photo", () => {
    renderBody(order({ status: "new", referenceImageUrl: null }));
    expect(screen.getByText("No reference photo attached")).toBeInTheDocument();
  });

  it("navigates back when the top bar back button is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderBody(order({ status: "new" }));
    await user.click(container.querySelector(".rounded-full")!);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("opens a confirmation dialog before deleting and does nothing on cancel", async () => {
    const user = userEvent.setup();
    renderBody(order({ status: "new" }));

    await user.click(screen.getByText("Delete order"));
    expect(screen.getByText("Delete this order?")).toBeInTheDocument();
    expect(screen.getByText(/permanently deletes order AD1 for Priya Sharma/)).toBeInTheDocument();

    await user.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Delete this order?")).not.toBeInTheDocument();
    expect(deleteOrder).not.toHaveBeenCalled();
  });

  it("deletes the order and navigates to the orders list on confirm", async () => {
    const user = userEvent.setup();
    renderBody(order({ status: "new" }));

    await user.click(screen.getByText("Delete order"));
    await user.click(screen.getByText("Delete permanently"));

    expect(deleteOrder).toHaveBeenCalledWith("AD1");
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders");
  });
});
