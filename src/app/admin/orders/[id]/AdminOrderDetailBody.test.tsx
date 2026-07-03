import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminOrderDetailBody from "./AdminOrderDetailBody";
import { assignMaster, assignTailor, updateOrderStatus, cancelOrder, deleteOrder } from "@/app/actions/orders";
import { mockRouter } from "../../../../../vitest.setup";
import type { Order } from "@/types";
import type { StaffListItem } from "@/app/actions/staff";

vi.mock("@/app/actions/orders", () => ({
  assignMaster: vi.fn(),
  assignTailor: vi.fn(),
  updateOrderStatus: vi.fn(),
  cancelOrder: vi.fn(),
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
    referenceImageUrls: [],
    materialImageUrls: [],
    mainMaterialImageUrl: null,
    cancellationCharge: null,
    createdAt: "2026-06-24",
    ...overrides,
  };
}

function renderBody(o: Order) {
  return render(<AdminOrderDetailBody order={o} masters={MASTERS} tailors={TAILORS} />);
}

describe("AdminOrderDetailBody", () => {
  beforeEach(() => {
    vi.mocked(assignMaster).mockReset();
    vi.mocked(assignMaster).mockResolvedValue(order({ status: "cutting", master: { id: "m1", name: "Ramesh K." } }));
    vi.mocked(assignTailor).mockReset();
    vi.mocked(assignTailor).mockResolvedValue(order({ status: "stitching", tailor: { id: "t1", name: "Anitha K." } }));
    vi.mocked(updateOrderStatus).mockReset();
    vi.mocked(updateOrderStatus).mockResolvedValue(order({ status: "ready" }));
    vi.mocked(cancelOrder).mockReset();
    vi.mocked(cancelOrder).mockResolvedValue(order({ status: "cancelled", cancellationCharge: 500 }));
    vi.mocked(deleteOrder).mockReset();
    vi.mocked(deleteOrder).mockResolvedValue(undefined);
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
    expect(screen.getByText(/^Assign master/)).toBeInTheDocument();
    expect(screen.queryByText(/^Assign tailor/)).not.toBeInTheDocument();
  });

  it("shows the tailor assignment select once cutting has started", () => {
    renderBody(order({ status: "cutting" }));
    expect(screen.getByText(/^Assign tailor/)).toBeInTheDocument();
  });

  it("loads the master and tailor options passed in as props", () => {
    renderBody(order({ status: "cutting" }));
    expect(screen.getByText("Ramesh K.")).toBeInTheDocument();
    expect(screen.getByText("Anitha K.")).toBeInTheDocument();
  });

  it("pre-selects the currently assigned master and tailor", () => {
    renderBody(order({ status: "cutting", master: { id: "m1", name: "Ramesh K." }, tailor: { id: "t1", name: "Anitha K." } }));
    expect(screen.getByDisplayValue("Ramesh K.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Anitha K.")).toBeInTheDocument();
  });

  it("assigns the master on selection alone — no separate save step — and reflects the returned order", async () => {
    const user = userEvent.setup();
    renderBody(order({ status: "new" }));

    await user.selectOptions(screen.getByDisplayValue("Select master…"), "m1");

    expect(assignMaster).toHaveBeenCalledWith("AD1", "m1");
    expect(screen.queryByText("Save Assignment")).not.toBeInTheDocument();
    await screen.findByText(/^Assign tailor/); // status moved to "cutting" per the mock
  });

  it("assigns null when the master selection is cleared", async () => {
    const user = userEvent.setup();
    renderBody(order({ status: "cutting", master: { id: "m1", name: "Ramesh K." } }));

    await user.selectOptions(screen.getByDisplayValue("Ramesh K."), "");

    expect(assignMaster).toHaveBeenCalledWith("AD1", null);
  });

  it("assigns the tailor on selection alone and reflects the returned order", async () => {
    const user = userEvent.setup();
    renderBody(order({ status: "cutting_done" }));

    await user.selectOptions(screen.getByDisplayValue("Select tailor…"), "t1");

    expect(assignTailor).toHaveBeenCalledWith("AD1", "t1");
  });

  it("assigns null when the tailor selection is cleared", async () => {
    const user = userEvent.setup();
    renderBody(order({ status: "cutting_done", tailor: { id: "t1", name: "Anitha K." } }));

    await user.selectOptions(screen.getByDisplayValue("Anitha K."), "");

    expect(assignTailor).toHaveBeenCalledWith("AD1", null);
  });

  it("lets the admin change the order status directly via the status dropdown", async () => {
    const user = userEvent.setup();
    renderBody(order({ status: "stitching" }));

    await user.selectOptions(screen.getByDisplayValue("Stitching"), "ready");

    expect(updateOrderStatus).toHaveBeenCalledWith("AD1", "ready");
    expect(await screen.findByDisplayValue("Ready")).toBeInTheDocument();
  });

  it("shows the delivered card alongside the status dropdown", () => {
    renderBody(order({ status: "delivered" }));
    expect(screen.getByText("Order delivered")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Delivered")).toBeInTheDocument();
  });

  it("shows the Hemming & Hook pending card with a release-to-Ready action", async () => {
    vi.mocked(updateOrderStatus).mockResolvedValue(order({ status: "ready" }));
    const user = userEvent.setup();
    renderBody(order({ status: "hemming_hook" }));

    expect(screen.getByText("Hemming & Hook pending")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Hemming & Hook")).toBeInTheDocument();

    await user.click(screen.getByText("✓ Mark Hemming & Hook Done → Ready"));
    expect(updateOrderStatus).toHaveBeenCalledWith("AD1", "ready");
    expect(await screen.findByDisplayValue("Ready")).toBeInTheDocument();
  });

  it("disables the release-to-Ready button and shows a pending label while in flight", async () => {
    let resolveUpdate: (o: ReturnType<typeof order>) => void = () => {};
    vi.mocked(updateOrderStatus).mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );
    const user = userEvent.setup();
    renderBody(order({ status: "hemming_hook" }));

    await user.click(screen.getByText("✓ Mark Hemming & Hook Done → Ready"));
    expect(screen.getByText("Updating…")).toBeDisabled();

    resolveUpdate(order({ status: "ready" }));
    expect(await screen.findByDisplayValue("Ready")).toBeInTheDocument();
  });

  it("shows the tailor assignment select while hemming & hook is pending", () => {
    renderBody(order({ status: "hemming_hook" }));
    expect(screen.getByText(/^Assign tailor/)).toBeInTheDocument();
  });

  it("renders the sketch and reference photo gallery when present", () => {
    renderBody(
      order({
        status: "new",
        sketchDataUrl: "data:image/png;base64,sketch",
        referenceImageUrls: ["data:image/png;base64,ref1", "data:image/png;base64,ref2"],
      })
    );
    expect(screen.getByAltText("Sketch")).toHaveAttribute("src", "data:image/png;base64,sketch");
    expect(screen.getByAltText("Reference 1")).toBeInTheDocument();
    expect(screen.getByAltText("Reference 2")).toBeInTheDocument();
  });

  it("shows a placeholder when there are no reference photos", () => {
    renderBody(order({ status: "new", referenceImageUrls: [] }));
    expect(screen.getByText("No reference photos")).toBeInTheDocument();
  });

  it("shows the material photo gallery between order details and measurements", () => {
    renderBody(order({ status: "new", materialImageUrls: ["data:image/png;base64,fabric"] }));
    expect(screen.getByAltText("Material 1")).toHaveAttribute("src", "data:image/png;base64,fabric");

    const details = screen.getByText("Order details");
    const photos = screen.getByText("Material photos");
    const measurements = screen.getByText("Measurements");
    expect(details.compareDocumentPosition(photos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(photos.compareDocumentPosition(measurements) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows a placeholder when there are no material photos", () => {
    renderBody(order({ status: "new", materialImageUrls: [] }));
    expect(screen.getByText("No material photos")).toBeInTheDocument();
  });

  it("navigates to the admin orders list (fresh, not a cached back-nav) when the top bar back button is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderBody(order({ status: "new" }));
    await user.click(container.querySelector(".rounded-full")!);
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders");
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

  describe("cancelling an order", () => {
    it("opens the cancel dialog, submits the charge, and shows the cancelled state", async () => {
      const user = userEvent.setup();
      renderBody(order({ status: "cutting", amount: 4200, advance: 1000 }));

      await user.click(screen.getByText("Cancel order"));
      expect(screen.getByText("Cancel order AD1?")).toBeInTheDocument();

      await user.type(screen.getByLabelText("Cancellation charge (₹)"), "500");
      const confirmButtons = screen.getAllByText("Cancel order", { selector: "button" });
      await user.click(confirmButtons[confirmButtons.length - 1]);

      expect(cancelOrder).toHaveBeenCalledWith("AD1", 500);
      await waitFor(() => expect(screen.getAllByText("Order cancelled").length).toBeGreaterThan(0));
      expect(screen.queryByText(/^Assign master/)).not.toBeInTheDocument();
      expect(screen.queryByText("Cancel order")).not.toBeInTheDocument();
    });

    it("keeps the order when Keep order is clicked", async () => {
      const user = userEvent.setup();
      renderBody(order({ status: "cutting" }));

      await user.click(screen.getByText("Cancel order"));
      await user.click(screen.getByText("Keep order"));

      expect(screen.queryByText("Cancel order AD1?")).not.toBeInTheDocument();
      expect(cancelOrder).not.toHaveBeenCalled();
    });

    it("clears the charge field each time the dialog is reopened", async () => {
      const user = userEvent.setup();
      renderBody(order({ status: "cutting" }));

      await user.click(screen.getByText("Cancel order"));
      await user.type(screen.getByLabelText("Cancellation charge (₹)"), "300");
      await user.click(screen.getByText("Keep order"));

      await user.click(screen.getByText("Cancel order"));
      expect(screen.getByLabelText("Cancellation charge (₹)")).toHaveValue(null);
    });

    it("strikes through the original amount and shows the cancellation charge as what's due", () => {
      renderBody(order({ status: "cancelled", amount: 4200, advance: 1000, cancellationCharge: 1500 }));

      const originalAmount = screen.getByText("₹4,200");
      expect(originalAmount).toHaveClass("line-through");
      expect(screen.getByText("Cancellation charge")).toBeInTheDocument();
      expect(screen.getByText("₹1,500")).toBeInTheDocument();
      expect(screen.getByText("Balance due")).toBeInTheDocument();
      expect(screen.getByText("₹500")).toBeInTheDocument(); // 1500 - 1000 advance
    });

    it("shows a refund due when advance already paid exceeds the cancellation charge", () => {
      renderBody(order({ status: "cancelled", amount: 4200, advance: 2000, cancellationCharge: 500 }));
      expect(screen.getByText("Refund due to customer")).toBeInTheDocument();
      expect(screen.getByText("₹1,500")).toBeInTheDocument(); // 2000 - 500
    });

    it("shows neither balance nor refund when the cancellation charge exactly matches the advance", () => {
      renderBody(order({ status: "cancelled", amount: 4200, advance: 500, cancellationCharge: 500 }));
      expect(screen.queryByText("Balance due")).not.toBeInTheDocument();
      expect(screen.queryByText("Refund due to customer")).not.toBeInTheDocument();
    });

    it("treats a missing cancellationCharge as zero", () => {
      renderBody(order({ status: "cancelled", amount: 4200, advance: 0, cancellationCharge: null }));
      expect(screen.getByText("Cancellation charge").nextSibling).toHaveTextContent("₹0");
    });
  });

  describe("mutation error handling", () => {
    it("shows an error toast when assigning a master fails", async () => {
      vi.mocked(assignMaster).mockRejectedValue(new Error("offline"));
      const user = userEvent.setup();
      renderBody(order({ status: "new" }));

      await user.selectOptions(screen.getByText(/^Assign master/).parentElement!.querySelector("select")!, "m1");

      expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the change");
    });

    it("shows an error toast when assigning a tailor fails", async () => {
      vi.mocked(assignTailor).mockRejectedValue(new Error("offline"));
      const user = userEvent.setup();
      renderBody(order({ status: "cutting_done" }));

      await user.selectOptions(screen.getByText(/^Assign tailor/).parentElement!.querySelector("select")!, "t1");

      expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the change");
    });

    it("shows an error toast when a status change fails", async () => {
      vi.mocked(updateOrderStatus).mockRejectedValue(new Error("offline"));
      const user = userEvent.setup();
      renderBody(order({ status: "cutting" }));

      await user.selectOptions(screen.getByText(/^Order status/).parentElement!.querySelector("select")!, "ready");

      expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the change");
    });

    it("keeps the cancel dialog open and shows a toast when cancelling fails", async () => {
      vi.mocked(cancelOrder).mockRejectedValue(new Error("offline"));
      const user = userEvent.setup();
      renderBody(order({ status: "new" }));

      await user.click(screen.getByText("Cancel order"));
      await user.type(screen.getByLabelText("Cancellation charge (₹)"), "500");
      const confirmButtons = screen.getAllByText("Cancel order", { selector: "button" });
      await user.click(confirmButtons[confirmButtons.length - 1]);

      expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the change");
      // The dialog stays open so the admin can retry.
      expect(screen.getByText("Cancel order AD1?")).toBeInTheDocument();
    });

    it("stays on the page and shows a toast when deleting fails", async () => {
      vi.mocked(deleteOrder).mockRejectedValue(new Error("offline"));
      const user = userEvent.setup();
      renderBody(order({ status: "new" }));

      await user.click(screen.getByText("Delete order"));
      await user.click(screen.getByText("Delete permanently"));

      expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't delete the order");
      expect(mockRouter.push).not.toHaveBeenCalledWith("/admin/orders");
    });

    it("shows an error toast when releasing to ready fails", async () => {
      vi.mocked(updateOrderStatus).mockRejectedValue(new Error("offline"));
      const user = userEvent.setup();
      renderBody(order({ status: "hemming_hook" }));

      await user.click(screen.getByText(/Mark Hemming & Hook Done/));

      expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the change");
    });
  });
});
