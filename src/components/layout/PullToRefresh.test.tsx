import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PullToRefresh from "./PullToRefresh";
import { mockRouter } from "../../../vitest.setup";

function pull(container: HTMLElement, distance: number) {
  fireEvent.touchStart(container, { touches: [{ clientY: 0 }] });
  fireEvent.touchMove(container, { touches: [{ clientY: distance }] });
}

describe("PullToRefresh", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders its children", () => {
    render(
      <PullToRefresh>
        <p>Order list</p>
      </PullToRefresh>
    );
    expect(screen.getByText("Order list")).toBeInTheDocument();
  });

  it("shows no spinner before any pull gesture", () => {
    render(
      <PullToRefresh>
        <p>content</p>
      </PullToRefresh>
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("refreshes when pulled past the threshold and hides the spinner once the refresh settles", () => {
    const { container } = render(
      <PullToRefresh>
        <p>content</p>
      </PullToRefresh>
    );
    const root = container.firstChild as HTMLElement;

    pull(root, 90);
    expect(screen.getByRole("status")).toBeInTheDocument();

    fireEvent.touchEnd(root);
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
    // The mocked refresh settles synchronously, so the transition is already
    // over and the indicator has collapsed — no fixed timeout involved.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not refresh when the pull distance stays below the threshold", () => {
    const { container } = render(
      <PullToRefresh>
        <p>content</p>
      </PullToRefresh>
    );
    const root = container.firstChild as HTMLElement;

    pull(root, 20);
    fireEvent.touchEnd(root);

    expect(mockRouter.refresh).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("ignores the gesture when the container is already scrolled down", () => {
    const { container } = render(
      <PullToRefresh>
        <p>content</p>
      </PullToRefresh>
    );
    const root = container.firstChild as HTMLElement;
    Object.defineProperty(root, "scrollTop", { value: 50, configurable: true });

    pull(root, 90);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.touchEnd(root);
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it("ignores a touchend with no preceding touchstart", () => {
    const { container } = render(
      <PullToRefresh>
        <p>content</p>
      </PullToRefresh>
    );
    const root = container.firstChild as HTMLElement;

    fireEvent.touchEnd(root);
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it("ignores further touchmove once refreshing has started", () => {
    vi.useFakeTimers();
    const { container } = render(
      <PullToRefresh>
        <p>content</p>
      </PullToRefresh>
    );
    const root = container.firstChild as HTMLElement;

    pull(root, 90);
    fireEvent.touchEnd(root);
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);

    fireEvent.touchMove(root, { touches: [{ clientY: 200 }] });
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
  });

  it("allows another refresh once the previous one has settled", () => {
    const { container } = render(
      <PullToRefresh>
        <p>content</p>
      </PullToRefresh>
    );
    const root = container.firstChild as HTMLElement;

    pull(root, 90);
    fireEvent.touchEnd(root);
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);

    pull(root, 90);
    fireEvent.touchEnd(root);
    expect(mockRouter.refresh).toHaveBeenCalledTimes(2);
  });

  it("does not track pull distance when the gesture moves upward", () => {
    const { container } = render(
      <PullToRefresh>
        <p>content</p>
      </PullToRefresh>
    );
    const root = container.firstChild as HTMLElement;

    fireEvent.touchStart(root, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(root, { touches: [{ clientY: 50 }] });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.touchEnd(root);
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it("applies a custom className when provided", () => {
    const { container } = render(
      <PullToRefresh className="custom-scroll">
        <p>content</p>
      </PullToRefresh>
    );
    expect(container.firstChild).toHaveClass("custom-scroll");
  });
});
