import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeliverOrderDialog from "./DeliverOrderDialog";
import { shopToday } from "@/lib/utils";

function setup(overrides: Partial<Parameters<typeof DeliverOrderDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <DeliverOrderDialog
      open
      orderId="B2505"
      balance={3400}
      pending={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />
  );
  return { onConfirm, onCancel };
}

describe("DeliverOrderDialog", () => {
  it("renders nothing while closed", () => {
    const { container } = render(
      <DeliverOrderDialog
        open={false}
        orderId="B2505"
        balance={3400}
        pending={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the exact balance to collect", () => {
    setup();
    expect(screen.getByText("Deliver order B2505")).toBeInTheDocument();
    expect(screen.getByText("₹3,400")).toBeInTheDocument();
  });

  // The whole point of the dialog: an order can't be handed over without
  // saying how the money arrived.
  it("won't confirm until a payment method is chosen", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();

    const confirm = screen.getByText("Collect & deliver");
    expect(confirm).toBeDisabled();

    await user.click(screen.getByText("UPI"));
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith("upi", expect.any(String));
  });

  it("passes cash through when cash is chosen", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    await user.click(screen.getByText("Cash"));
    await user.click(screen.getByText("Collect & deliver"));
    expect(onConfirm).toHaveBeenCalledWith("cash", expect.any(String));
  });

  it("marks the chosen method as pressed", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("Cash"));
    expect(screen.getByText("Cash").closest("button")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("UPI").closest("button")).toHaveAttribute("aria-pressed", "false");
  });

  // Nothing was collected, so there's no method to ask about — and none is
  // recorded, rather than inventing "cash" for money that never moved.
  it("skips the method question when the order is already paid in full", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup({ balance: 0 });

    expect(screen.getByText(/already paid in full/)).toBeInTheDocument();
    expect(screen.queryByText("UPI")).not.toBeInTheDocument();

    const confirm = screen.getByText("Mark delivered");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalled();
  });

  it("treats an overpaid order as nothing to collect", () => {
    setup({ balance: -200 });
    expect(screen.getByText(/already paid in full/)).toBeInTheDocument();
  });

  it("disables both buttons and shows progress while saving", () => {
    setup({ pending: true });
    expect(screen.getByText("Saving…")).toBeDisabled();
    expect(screen.getByText("Not yet")).toBeDisabled();
  });

  it("backs out without delivering", async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = setup();
    await user.click(screen.getByText("Not yet"));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // Same rule as every other date the admin records: today by default,
  // backdating allowed because the shop writes hand-overs up later, no
  // future dates.
  describe("the delivery date", () => {
    it("defaults to today", () => {
      setup();
      expect(screen.getByLabelText("Delivered on")).toHaveValue(shopToday());
    });

    it("travels with the confirmation", async () => {
      const user = userEvent.setup();
      const { onConfirm } = setup();
      fireEvent.change(screen.getByLabelText("Delivered on"), { target: { value: "2026-08-20" } });
      // The method buttons carry a hint line, so their accessible name is
      // "Cash Notes at the counter" — match the visible label instead.
      await user.click(screen.getByText("Cash"));
      await user.click(screen.getByText("Collect & deliver"));
      expect(onConfirm).toHaveBeenCalledWith("cash", "2026-08-20");
    });

    it("blocks a future date", () => {
      setup();
      fireEvent.change(screen.getByLabelText("Delivered on"), { target: { value: "2099-01-01" } });
      expect(screen.getByText(/hasn't happened yet/)).toBeInTheDocument();
      expect(screen.getByText("Collect & deliver").closest("button")).toBeDisabled();
    });
  });
});
