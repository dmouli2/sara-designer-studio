import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDialog from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ConfirmDialog open={false} title="Delete order" message="Sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders title, message and default button labels when open", () => {
    render(<ConfirmDialog open title="Delete order" message="This cannot be undone." onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("Delete order")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Confirm")).toBeInTheDocument();
  });

  it("uses custom confirm/cancel labels when provided", () => {
    render(
      <ConfirmDialog
        open
        title="Delete order"
        message="Sure?"
        confirmLabel="Delete forever"
        cancelLabel="Keep it"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText("Delete forever")).toBeInTheDocument();
    expect(screen.getByText("Keep it")).toBeInTheDocument();
  });

  it("calls onConfirm and onCancel when their buttons are clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Delete order" message="Sure?" onConfirm={onConfirm} onCancel={onCancel} />);

    await user.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("applies destructive styling when destructive is true", () => {
    render(<ConfirmDialog open destructive title="Delete order" message="Sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("Confirm")).toHaveClass("bg-[#B04A4A]");
  });

  it("disables both buttons and shows a pending label while pending", () => {
    render(<ConfirmDialog open pending title="Delete order" message="Sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("Cancel")).toBeDisabled();
    expect(screen.getByText("Please wait…")).toBeDisabled();
  });
});
