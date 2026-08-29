import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentSplitPicker from "./PaymentSplitPicker";
import type { PaymentSplit } from "@/types";

function setup(total: number | null, value: PaymentSplit = { cash: 0, upi: 0 }) {
  const onChange = vi.fn();
  render(<PaymentSplitPicker idPrefix="t" total={total} value={value} onChange={onChange} />);
  return { onChange };
}

describe("PaymentSplitPicker", () => {
  // Lighting a button for an empty split would claim a choice nobody made,
  // and leave a selected button beside a disabled confirm.
  it("lights nothing until money has been attributed", () => {
    setup(1000);
    for (const label of ["Cash", "UPI", "Both"]) {
      expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("shows which method a pre-set payment used", () => {
    setup(1000, { cash: 0, upi: 1000 });
    expect(screen.getByRole("button", { name: "UPI" })).toHaveAttribute("aria-pressed", "true");
  });

  // One tap for the ordinary payment — the split boxes are the exception.
  it("assigns the whole total to a single method in one tap", async () => {
    const user = userEvent.setup();
    const { onChange } = setup(1000);

    await user.click(screen.getByRole("button", { name: "Cash" }));
    expect(onChange).toHaveBeenLastCalledWith({ cash: 1000, upi: 0 });

    await user.click(screen.getByRole("button", { name: "UPI" }));
    expect(onChange).toHaveBeenLastCalledWith({ cash: 0, upi: 1000 });
  });

  it("hides the amount boxes unless the payment is split", async () => {
    const user = userEvent.setup();
    setup(1000);
    expect(screen.queryByLabelText("Cash (₹)")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Both" }));
    expect(screen.getByLabelText("Cash (₹)")).toBeInTheDocument();
    expect(screen.getByLabelText("UPI (₹)")).toBeInTheDocument();
  });

  // Halving the total would be a guess the admin has to undo.
  it("does not pre-fill the split boxes", async () => {
    const user = userEvent.setup();
    const { onChange } = setup(1000);
    await user.click(screen.getByRole("button", { name: "Both" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports each side as it is typed", async () => {
    const user = userEvent.setup();
    const { onChange } = setup(1000, { cash: 600, upi: 0 });
    await user.click(screen.getByRole("button", { name: "Both" }));
    fireEvent.change(screen.getByLabelText("UPI (₹)"), { target: { value: "400" } });
    expect(onChange).toHaveBeenLastCalledWith({ cash: 600, upi: 400 });
  });

  it("says what is still unaccounted for, and what overshoots", async () => {
    const user = userEvent.setup();
    const { onChange } = setup(1000, { cash: 600, upi: 0 });
    await user.click(screen.getByRole("button", { name: "Both" }));
    expect(screen.getByText("₹400 still unaccounted for.")).toBeInTheDocument();

    onChange.mockClear();
    render(<PaymentSplitPicker idPrefix="u" total={1000} value={{ cash: 900, upi: 900 }} onChange={onChange} />);
    expect(screen.getByText("₹800 more than the ₹1,000 due.")).toBeInTheDocument();
  });

  // An optional part payment has no fixed total to reconcile against.
  it("enforces no total when the amount is the admin's to choose", async () => {
    const user = userEvent.setup();
    setup(null, { cash: 300, upi: 0 });
    await user.click(screen.getByRole("button", { name: "Both" }));
    expect(screen.queryByText(/unaccounted for/)).not.toBeInTheDocument();
  });

  it("keeps a single-method payment's amount when there is no fixed total", async () => {
    const user = userEvent.setup();
    const { onChange } = setup(null, { cash: 0, upi: 250 });
    await user.click(screen.getByRole("button", { name: "Cash" }));
    expect(onChange).toHaveBeenLastCalledWith({ cash: 250, upi: 0 });
  });
});
