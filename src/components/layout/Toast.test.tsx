import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Toast from "./Toast";

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when there is no message", () => {
    const { container } = render(<Toast message={null} onDismiss={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the message as an alert", () => {
    render(<Toast message="Something went wrong" onDismiss={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("auto-dismisses after a few seconds", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast message="Oops" onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses on tap", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<Toast message="Oops" onDismiss={onDismiss} />);

    await user.click(screen.getByRole("alert"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("clears the pending auto-dismiss when the message is removed", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { rerender } = render(<Toast message="Oops" onDismiss={onDismiss} />);

    rerender(<Toast message={null} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
