import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CancelOrderDialog from "./CancelOrderDialog";

describe("CancelOrderDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <CancelOrderDialog open={false} orderId="B2401" pending={false} onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the order id and disables confirm until a valid charge is entered", async () => {
    const user = userEvent.setup();
    render(<CancelOrderDialog open={true} orderId="B2401" pending={false} onConfirm={() => {}} onCancel={() => {}} />);

    expect(screen.getByText("Cancel order B2401?")).toBeInTheDocument();
    const confirmBtn = screen.getByText("Cancel order", { selector: "button" });
    expect(confirmBtn).toBeDisabled();

    await user.type(screen.getByLabelText("Cancellation charge (₹)"), "500");
    expect(confirmBtn).not.toBeDisabled();
  });

  it("calls onConfirm with the parsed charge", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<CancelOrderDialog open={true} orderId="B2401" pending={false} onConfirm={onConfirm} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Cancellation charge (₹)"), "500");
    await user.click(screen.getByText("Cancel order", { selector: "button" }));

    expect(onConfirm).toHaveBeenCalledWith(500);
  });

  it("accepts a zero charge", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<CancelOrderDialog open={true} orderId="B2401" pending={false} onConfirm={onConfirm} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Cancellation charge (₹)"), "0");
    expect(screen.getByText("Cancel order", { selector: "button" })).not.toBeDisabled();
    await user.click(screen.getByText("Cancel order", { selector: "button" }));

    expect(onConfirm).toHaveBeenCalledWith(0);
  });

  it("calls onCancel when Keep order is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<CancelOrderDialog open={true} orderId="B2401" pending={false} onConfirm={() => {}} onCancel={onCancel} />);

    await user.click(screen.getByText("Keep order"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("disables both buttons while pending and shows the pending label", () => {
    render(<CancelOrderDialog open={true} orderId="B2401" pending={true} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText("Keep order")).toBeDisabled();
    expect(screen.getByText("Cancelling…")).toBeDisabled();
  });
});
