import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeliverPieceDialog from "./DeliverPieceDialog";
import type { OrderPiece } from "@/types";

const piece: OrderPiece = {
  id: "p2",
  label: "Blouse 2",
  due: "2026-09-10",
  status: "pending",
  deliveredAt: null,
};

function setup(overrides: Partial<Parameters<typeof DeliverPieceDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <DeliverPieceDialog
      open
      piece={piece}
      balance={2000}
      isLast={false}
      pending={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />
  );
  return { onConfirm, onCancel };
}

describe("DeliverPieceDialog", () => {
  it("renders nothing while closed", () => {
    const { container } = render(
      <DeliverPieceDialog
        open={false}
        piece={piece}
        balance={2000}
        isLast={false}
        pending={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("names the garment and says the order stays open", () => {
    setup();
    expect(screen.getByText("Hand over Blouse 2")).toBeInTheDocument();
    expect(screen.getByText(/rest of the order stays open/)).toBeInTheDocument();
    expect(screen.getByText("₹2,000")).toBeInTheDocument();
  });

  // Taking nothing is the normal case for an early piece — the customer
  // usually settles up when the last one goes out.
  it("hands an early piece over with no payment at all", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    await user.click(screen.getByRole("button", { name: "Hand over" }));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it("asks how the money arrived only once an amount is typed", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();

    expect(screen.queryByRole("button", { name: "Cash" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/Collecting now/), "800");
    expect(screen.getByText("How was the ₹800 paid?")).toBeInTheDocument();

    // No method chosen yet — nothing can be recorded.
    expect(screen.getByRole("button", { name: "Collect & hand over" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "UPI" }));
    await user.click(screen.getByRole("button", { name: "Collect & hand over" }));
    expect(onConfirm).toHaveBeenCalledWith({ amount: 800, method: "upi" });
  });

  it("refuses an amount larger than the order owes", async () => {
    const user = userEvent.setup();
    setup({ balance: 500 });
    await user.type(screen.getByLabelText(/Collecting now/), "900");
    expect(screen.getByText(/more than the ₹500 still owed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hand over/i })).toBeDisabled();
  });

  // The last hand-over IS the order being delivered, so the amount stops
  // being a choice — same rule as DeliverOrderDialog.
  it("collects the whole balance on the last piece with no amount field", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup({ isLast: true });

    expect(screen.getByText(/last piece/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Collecting now/)).not.toBeInTheDocument();
    expect(screen.getByText("Balance to collect")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cash" }));
    await user.click(screen.getByRole("button", { name: "Collect & hand over" }));
    expect(onConfirm).toHaveBeenCalledWith({ amount: 2000, method: "cash" });
  });

  it("asks nothing when the order is already paid in full", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup({ balance: 0, isLast: true });
    expect(screen.getByText(/Nothing left to collect/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hand over" }));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it("backs out without handing anything over", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = setup();
    await user.click(screen.getByRole("button", { name: "Not yet" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("locks both buttons while the save is in flight", () => {
    setup({ pending: true });
    expect(screen.getByRole("button", { name: "Not yet" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
});
