import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminOrderDetailBody from "./AdminOrderDetailBody";
import {
  assignMaster,
  assignTailor,
  updateOrderStatus,
  deliverOrder,
  deliverPiece,
  updatePieceDue,
  startAlteration,
  completeAlteration,
  redeliverAlteration,
  cancelOrder,
  deleteOrder,
} from "@/app/actions/orders";
import { mockRouter } from "../../../../../vitest.setup";
import type { AlterationRecord, Order, OrderPiece } from "@/types";

function piece(over: Partial<OrderPiece> = {}): OrderPiece {
  return { id: "p1", label: "Blouse 1", due: "2026-07-10", status: "pending", deliveredAt: null, ...over };
}

function alteration(over: Partial<AlterationRecord> = {}): AlterationRecord {
  return {
    id: "a1",
    reason: "Sleeve tight",
    pieceLabel: null,
    receivedAt: "2026-08-01",
    promisedAt: "2026-08-08",
    completedAt: null,
    redeliveredAt: null,
    ...over,
  };
}

const THREE_PIECES: OrderPiece[] = [
  piece(),
  piece({ id: "p2", label: "Blouse 2" }),
  piece({ id: "p3", label: "Blouse 3" }),
];
import type { StaffListItem } from "@/app/actions/staff";

vi.mock("@/app/actions/orders", () => ({
  assignMaster: vi.fn(),
  assignTailor: vi.fn(),
  updateOrderStatus: vi.fn(),
  deliverOrder: vi.fn(),
  deliverPiece: vi.fn(),
  updatePieceDue: vi.fn(),
  startAlteration: vi.fn(),
  completeAlteration: vi.fn(),
  redeliverAlteration: vi.fn(),
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
    advanceMethod: null,
    advanceSplit: null,
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
    createdAt: "2026-06-24",
    ...overrides,
  };
}

function renderBody(o: Order, shareToken: string | null = "tok-abc123") {
  return render(
    <AdminOrderDetailBody order={o} masters={MASTERS} tailors={TAILORS} shareToken={shareToken} />
  );
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
    vi.mocked(deliverOrder).mockReset();
    vi.mocked(deliverOrder).mockResolvedValue(order({ status: "delivered" }));
    vi.mocked(deliverPiece).mockReset();
    vi.mocked(deliverPiece).mockResolvedValue(
      order({ status: "partly_delivered", pieces: [piece({ status: "delivered" }), THREE_PIECES[1], THREE_PIECES[2]] })
    );
    vi.mocked(updatePieceDue).mockReset();
    vi.mocked(updatePieceDue).mockResolvedValue(order({ pieces: THREE_PIECES }));
    vi.mocked(startAlteration).mockReset();
    vi.mocked(startAlteration).mockResolvedValue(
      order({ status: "delivered", alterations: [alteration()] })
    );
    vi.mocked(completeAlteration).mockReset();
    vi.mocked(completeAlteration).mockResolvedValue(
      order({ status: "delivered", alterations: [alteration({ completedAt: "2026-08-05" })] })
    );
    vi.mocked(redeliverAlteration).mockReset();
    vi.mocked(redeliverAlteration).mockResolvedValue(
      order({ status: "delivered", alterations: [alteration({ completedAt: "2026-08-05", redeliveredAt: "2026-08-06" })] })
    );
  });

  it("shows order details, progress and payment summary", () => {
    renderBody(order({ status: "new", amount: 4200, advance: 1000 }));
    expect(screen.getByText("Order progress")).toBeInTheDocument();
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("₹4,200")).toBeInTheDocument();
    expect(screen.getByText("₹3,200")).toBeInTheDocument(); // balance
  });

  it("shows notes and line items with qty × price line totals and item comments", () => {
    renderBody(
      order({
        status: "new",
        notes: "Heavy embroidery border",
        lineItems: [
          { particulars: "Blouse", qty: 1, amount: 3800 },
          { particulars: "Lining Blouse", qty: 2, amount: 100, note: "double stitch" },
        ],
      })
    );
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Heavy embroidery border")).toBeInTheDocument();
    expect(screen.getByText("Blouse ×1 @ ₹3,800")).toBeInTheDocument();
    // qty 2 × ₹100 must display ₹200, and the item comment shows beneath.
    expect(screen.getByText("Lining Blouse ×2 @ ₹100")).toBeInTheDocument();
    expect(screen.getByText("₹200")).toBeInTheDocument();
    expect(screen.getByText("(double stitch)")).toBeInTheDocument();
  });

  it("navigates to the edit page from the Edit order button", async () => {
    const user = userEvent.setup();
    renderBody(order({ status: "new" }));
    await user.click(screen.getByText("Edit order"));
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders/AD1/edit");
  });

  it.each(["delivered", "cancelled"] as const)("hides the Edit order button for a %s order", (status) => {
    renderBody(order({ status, cancellationCharge: status === "cancelled" ? 500 : null }));
    expect(screen.queryByText("Edit order")).not.toBeInTheDocument();
  });

  it("shows the balance in green when the order is fully paid", () => {
    renderBody(order({ status: "new", amount: 1800, advance: 1800 }));
    const balanceValue = screen.getByText("Balance due").parentElement!.querySelector("span:last-child")!;
    expect(balanceValue).toHaveClass("text-success");
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

  describe("measurement garment", () => {
    it("stands in for the measurement grid, and says whose garment it is", () => {
      renderBody(order({ sampleGarment: true }));
      expect(screen.getByText("Measurement blouse with us")).toBeInTheDocument();
      expect(screen.getByText(/hand it back with the order/i)).toBeInTheDocument();
      expect(screen.queryByText("No measurements recorded.")).not.toBeInTheDocument();
    });

    it("shows the note AND the figures when the order carries some", () => {
      renderBody(order({ sampleGarment: true, measurements: {
            type: "blouse",
            length: "16", shoulder: "", hs: "", sl: "", mlos: "", tlos: "", ahs: "", ub: "",
            bust: "", waist: "", fnNr: "", bn: "", dart: "", dbd: "", p: "", sareeFall: "", piko: "",
          } }));
      expect(screen.getByText("Measurement blouse with us")).toBeInTheDocument();
      expect(screen.getByText(/anything below is an adjustment to it/i)).toBeInTheDocument();
      expect(screen.getByText("16 in")).toBeInTheDocument();
    });

    it("says plainly when an ordinary order was never measured", () => {
      renderBody(order({}));
      expect(screen.getByText("No measurements recorded.")).toBeInTheDocument();
    });

    it("shows the measurement grid as before on an ordinary order", () => {
      renderBody(
        order({
          measurements: {
            type: "generic", bust: "34", waist: "", hip: "", length: "", shoulder: "",
            sleeve: "", neckDepth: "", armRound: "",
          },
        })
      );
      expect(screen.getByText("34 in")).toBeInTheDocument();
      expect(screen.queryByText(/Measurement blouse with us/)).not.toBeInTheDocument();
    });
  });

  it("shows a placeholder when there are no material photos", () => {
    renderBody(order({ status: "new", materialImageUrls: [] }));
    expect(screen.getByText("No material photos")).toBeInTheDocument();
  });

  it("navigates to the admin orders list (fresh, not a cached back-nav) when the top bar back button is clicked", async () => {
    const user = userEvent.setup();
    renderBody(order({ status: "new" }));
    await user.click(screen.getByLabelText("Back"));
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

  describe("sharing the status with the customer", () => {
    // Sharing used to be possible only on the success modal right after
    // placing an order; the admin can now re-send an update at any point.
    it("opens WhatsApp with the customer's number and a status update", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      const user = userEvent.setup();
      renderBody(order({ id: "B2505", customer: "Dharshini", phone: "9876543210", status: "stitching" }));

      await user.click(screen.getByText("Share status with customer"));

      expect(openSpy).toHaveBeenCalledTimes(1);
      const [url, target] = openSpy.mock.calls[0];
      expect(url).toContain("https://wa.me/919876543210");
      const text = decodeURIComponent(url as string);
      expect(text).toContain("update on your order B2505");
      expect(text).toContain("Status: Stitching in progress");
      expect(text).toContain("/track/tok-abc123");
      expect(target).toBe("_blank");
      openSpy.mockRestore();
    });

    it("changes nothing about the order — no action is called", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      const user = userEvent.setup();
      renderBody(order({ status: "cutting" }));

      await user.click(screen.getByText("Share status with customer"));

      expect(updateOrderStatus).not.toHaveBeenCalled();
      expect(assignMaster).not.toHaveBeenCalled();
      expect(assignTailor).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });

    it("is available all the way through to delivered", () => {
      renderBody(order({ status: "delivered" }));
      expect(screen.getByText("Share status with customer")).toBeInTheDocument();
    });

    it("is hidden for a cancelled order", () => {
      renderBody(order({ status: "cancelled", cancellationCharge: 500 }));
      expect(screen.queryByText("Share status with customer")).not.toBeInTheDocument();
    });

    // Rather than sending a link that would 404 on the customer's phone.
    it("is hidden when the order has no tracking token", () => {
      renderBody(order({ status: "ready" }), null);
      expect(screen.queryByText("Share status with customer")).not.toBeInTheDocument();
    });
  });


  describe("collecting payment on delivery", () => {
    function statusSelect() {
      return screen.getByText(/^Order status/).parentElement!.querySelector("select")!;
    }

    // Handing the order over is also when the balance arrives, so choosing
    // "Delivered" opens the payment dialog instead of saving straight away.
    it("opens the payment dialog instead of delivering immediately", async () => {
      const user = userEvent.setup();
      renderBody(order({ status: "ready", amount: 4200, advance: 1000 }));

      await user.selectOptions(statusSelect(), "delivered");

      expect(screen.getByText("Deliver order AD1")).toBeInTheDocument();
      // Scoped to the dialog — the page's Payment card shows the same figure.
      expect(screen.getByText("Balance to collect").parentElement).toHaveTextContent("₹3,200");
      expect(updateOrderStatus).not.toHaveBeenCalled();
      expect(deliverOrder).not.toHaveBeenCalled();
    });

    it("delivers with the chosen method once confirmed", async () => {
      vi.mocked(deliverOrder).mockResolvedValue(
        order({ status: "delivered", amount: 4200, advance: 1000, finalPayment: 3200, finalPaymentMethod: "upi" })
      );
      const user = userEvent.setup();
      renderBody(order({ status: "ready", amount: 4200, advance: 1000 }));

      await user.selectOptions(statusSelect(), "delivered");
      await user.click(screen.getByText("UPI"));
      await user.click(screen.getByText("Collect & deliver"));

      expect(deliverOrder).toHaveBeenCalledWith("AD1", { cash: 0, upi: 3200 }, expect.any(String));
      expect(await screen.findByText("Collected on delivery")).toBeInTheDocument();
    });

    it("backing out of the dialog leaves the order untouched", async () => {
      const user = userEvent.setup();
      renderBody(order({ status: "ready" }));

      await user.selectOptions(statusSelect(), "delivered");
      await user.click(screen.getByText("Not yet"));

      expect(screen.queryByText("Deliver order AD1")).not.toBeInTheDocument();
      expect(deliverOrder).not.toHaveBeenCalled();
    });

    it("surfaces a failure and keeps the dialog open", async () => {
      vi.mocked(deliverOrder).mockRejectedValue(new Error("offline"));
      const user = userEvent.setup();
      renderBody(order({ status: "ready", amount: 4200, advance: 1000 }));

      await user.selectOptions(statusSelect(), "delivered");
      await user.click(screen.getByText("Cash"));
      await user.click(screen.getByText("Collect & deliver"));

      expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the change");
      expect(screen.getByText("Deliver order AD1")).toBeInTheDocument();
    });

    it("shows both payments with their methods on a settled order", () => {
      renderBody(
        order({
          status: "delivered",
          amount: 4200,
          advance: 1000,
          advanceMethod: "cash",
          finalPayment: 3200,
          finalPaymentMethod: "upi",
        })
      );
      expect(screen.getByText("₹1,000 · Cash")).toBeInTheDocument();
      expect(screen.getByText("₹3,200 · UPI")).toBeInTheDocument();
    });

    // The 11 orders delivered before this feature existed were settled by the
    // migration, but their method is genuinely unknown — say so rather than
    // inventing one.
    it("says the method wasn't recorded for an order settled by the backfill", () => {
      renderBody(
        order({ status: "delivered", amount: 1000, advance: 0, finalPayment: 1000, finalPaymentMethod: null })
      );
      expect(screen.getByText("₹1,000 · method not recorded")).toBeInTheDocument();
    });
  });


  // ── Multi-piece orders ────────────────────────────────────────────────

  describe("a split order", () => {
    it("shows no pieces card on a single-garment order", () => {
      renderBody(order({ status: "ready" }));
      expect(screen.queryByText(/of 3 delivered/)).not.toBeInTheDocument();
    });

    it("lists the garments with the delivered count", () => {
      renderBody(order({ status: "ready", pieces: THREE_PIECES }));
      expect(screen.getByText("0 of 3 delivered")).toBeInTheDocument();
      expect(screen.getByText("Blouse 2")).toBeInTheDocument();
    });

    it("hands one garment over and keeps the order open", async () => {
      const user = userEvent.setup();
      renderBody(order({ status: "ready", pieces: THREE_PIECES }));

      await user.click(screen.getAllByRole("button", { name: "Hand over" })[0]);
      expect(screen.getByText("Hand over Blouse 1")).toBeInTheDocument();
      // Not the last piece, so no money is required. The card's own buttons
      // stay mounted behind the dialog, whose confirm renders last.
      const confirm = screen.getAllByRole("button", { name: "Hand over" }).at(-1)!;
      await user.click(confirm);

      await waitFor(() =>
        expect(deliverPiece).toHaveBeenCalledWith("AD1", "p1", undefined, expect.any(String))
      );
      await waitFor(() => expect(screen.getByText("1 of 3 delivered")).toBeInTheDocument());
      // Badge, not the dropdown option that carries the same label.
      expect(
        screen.getByText("Part Delivered", { selector: "span.badge-partly_delivered" })
      ).toBeInTheDocument();
    });

    it("collects a part payment with the hand-over", async () => {
      const user = userEvent.setup();
      renderBody(order({ status: "ready", pieces: THREE_PIECES, amount: 4200, advance: 1000 }));

      await user.click(screen.getAllByRole("button", { name: "Hand over" })[0]);
      await user.type(screen.getByLabelText(/Collecting now/), "800");
      await user.click(screen.getByRole("button", { name: "UPI" }));
      await user.click(screen.getByRole("button", { name: "Collect & hand over" }));

      await waitFor(() =>
        expect(deliverPiece).toHaveBeenCalledWith(
          "AD1",
          "p1",
          { cash: 0, upi: 800 },
          expect.any(String)
        )
      );
    });

    it("treats the only remaining garment as the whole order", async () => {
      const user = userEvent.setup();
      renderBody(
        order({
          status: "partly_delivered",
          pieces: [piece({ status: "delivered" }), piece({ id: "p2", label: "Blouse 2" })],
        })
      );
      await user.click(screen.getByRole("button", { name: "Hand over" }));
      expect(screen.getByText(/last piece/)).toBeInTheDocument();
    });

    it("surfaces a failure and leaves the dialog open", async () => {
      const user = userEvent.setup();
      vi.mocked(deliverPiece).mockRejectedValue(new Error("nope"));
      renderBody(order({ status: "ready", pieces: THREE_PIECES }));

      await user.click(screen.getAllByRole("button", { name: "Hand over" })[0]);
      await user.click(screen.getAllByRole("button", { name: "Hand over" }).at(-1)!);

      expect(await screen.findByText(/Couldn't save the change/)).toBeInTheDocument();
      expect(screen.getByText("Hand over Blouse 1")).toBeInTheDocument();
    });

    it("backs out of the hand-over without calling the action", async () => {
      const user = userEvent.setup();
      renderBody(order({ status: "ready", pieces: THREE_PIECES }));
      await user.click(screen.getAllByRole("button", { name: "Hand over" })[0]);
      await user.click(screen.getByRole("button", { name: "Not yet" }));
      expect(screen.queryByText("Hand over Blouse 1")).not.toBeInTheDocument();
      expect(deliverPiece).not.toHaveBeenCalled();
    });

    it("pushes a garment's delivery date", async () => {
      const user = userEvent.setup();
      renderBody(order({ status: "ready", pieces: THREE_PIECES }));
      await user.click(screen.getByRole("button", { name: "Change Blouse 2 delivery date" }));
      fireEvent.change(screen.getByLabelText("Blouse 2 delivery date"), {
        target: { value: "2026-08-01" },
      });
      await waitFor(() => expect(updatePieceDue).toHaveBeenCalledWith("AD1", "p2", "2026-08-01"));
    });

    it("shows a toast when a date change fails", async () => {
      const user = userEvent.setup();
      vi.mocked(updatePieceDue).mockRejectedValue(new Error("nope"));
      renderBody(order({ status: "ready", pieces: THREE_PIECES }));
      await user.click(screen.getByRole("button", { name: "Change Blouse 1 delivery date" }));
      fireEvent.change(screen.getByLabelText("Blouse 1 delivery date"), {
        target: { value: "2026-08-01" },
      });
      expect(await screen.findByText(/Couldn't save the change/)).toBeInTheDocument();
    });

    // Part Delivered describes what physically left the shop, so it can be
    // shown but never chosen.
    it("shows Part Delivered in the status dropdown but won't let it be picked", () => {
      renderBody(order({ status: "partly_delivered", pieces: THREE_PIECES }));
      const option = screen.getByRole("option", { name: "Part Delivered" }) as HTMLOptionElement;
      expect(option.disabled).toBe(true);
    });

    it("breaks down where the money came from once it arrives in instalments", () => {
      renderBody(
        order({
          status: "partly_delivered",
          pieces: THREE_PIECES,
          finalPayment: 1100,
          finalPaymentMethod: "upi",
          payments: [
            { id: "x", amount: 800, method: "cash", at: "2026-07-02T00:00:00Z", pieceId: "p1" },
            { id: "y", amount: 300, method: "upi", at: "2026-07-09T00:00:00Z", pieceId: null },
          ],
        })
      );
      expect(screen.getByText("Collected since")).toBeInTheDocument();
      expect(screen.getByText(/₹800 · Cash/)).toBeInTheDocument();
      expect(screen.getByText(/₹300 · UPI/)).toBeInTheDocument();
    });
  });

  // ── Alterations ───────────────────────────────────────────────────────

  describe("alterations", () => {
    it("offers nothing before the order is delivered", () => {
      renderBody(order({ status: "ready" }));
      expect(screen.queryByRole("button", { name: /Came back for alteration/ })).not.toBeInTheDocument();
    });

    it("takes a delivered garment back in", async () => {
      const user = userEvent.setup();
      renderBody(order({ status: "delivered" }));

      await user.click(screen.getByRole("button", { name: /Came back for alteration/ }));
      await user.type(screen.getByLabelText(/What needs changing/), "Sleeve tight");
      await user.click(screen.getByRole("button", { name: "Take it in" }));

      await waitFor(() =>
        expect(startAlteration).toHaveBeenCalledWith("AD1", {
          reason: "Sleeve tight",
          promisedAt: expect.any(String),
          pieceLabel: null,
          receivedAt: expect.any(String),
        })
      );
      // The badge now says what the admin needs to read, and the "delivered"
      // banner steps aside.
      expect(await screen.findByText("In Alteration")).toBeInTheDocument();
      expect(screen.queryByText("Order delivered")).not.toBeInTheDocument();
    });

    it("walks done → handed back, one button at a time", async () => {
      const user = userEvent.setup();
      renderBody(order({ status: "delivered", alterations: [alteration()] }));

      await user.click(screen.getByRole("button", { name: "✓ Alteration done" }));
      await waitFor(() => expect(completeAlteration).toHaveBeenCalledWith("AD1", expect.any(String)));

      expect(await screen.findByText("Alteration Done")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "✓ Handed back to customer" }));
      await waitFor(() => expect(redeliverAlteration).toHaveBeenCalledWith("AD1", expect.any(String)));

      // Record closed — back to a plain delivered order with its history.
      expect(await screen.findByText(/Altered & returned/)).toBeInTheDocument();
      expect(screen.queryByText("In Alteration")).not.toBeInTheDocument();
      expect(screen.queryByText("Alteration Done")).not.toBeInTheDocument();
    });

    it("shows a toast when an alteration step fails", async () => {
      const user = userEvent.setup();
      vi.mocked(completeAlteration).mockRejectedValue(new Error("nope"));
      renderBody(order({ status: "delivered", alterations: [alteration()] }));
      await user.click(screen.getByRole("button", { name: "✓ Alteration done" }));
      expect(await screen.findByText(/Couldn't save the change/)).toBeInTheDocument();
    });

    it("closes the take-in dialog without recording anything", async () => {
      const user = userEvent.setup();
      renderBody(order({ status: "delivered" }));
      await user.click(screen.getByRole("button", { name: /Came back for alteration/ }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(startAlteration).not.toHaveBeenCalled();
    });

    it("hides the whole panel on a cancelled order", () => {
      renderBody(order({ status: "cancelled", cancellationCharge: 500 }));
      expect(screen.queryByText("Alterations")).not.toBeInTheDocument();
    });

    // The customer should be told the garment is with us, not that it was
    // already delivered.
    it("tells the customer the alteration state, not the stored status", async () => {
      const user = userEvent.setup();
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      renderBody(order({ status: "delivered", alterations: [alteration()] }));

      await user.click(screen.getByRole("button", { name: /Share status with customer/ }));
      expect(open).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("With us for alteration")),
        "_blank"
      );
      open.mockRestore();
    });
  });

});
