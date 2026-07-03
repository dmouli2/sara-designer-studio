import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProgressTracker from "./ProgressTracker";

describe("ProgressTracker", () => {
  it("marks no steps done for a new order", () => {
    render(<ProgressTracker status="new" />);
    expect(screen.queryAllByText("✓")).toHaveLength(0);
    expect(screen.getByText("Ordered")).toBeInTheDocument();
  });

  it("marks one step done for cutting", () => {
    render(<ProgressTracker status="cutting" />);
    expect(screen.getAllByText("✓")).toHaveLength(1);
  });

  it("treats cutting_done the same as cutting for step position", () => {
    render(<ProgressTracker status="cutting_done" />);
    expect(screen.getAllByText("✓")).toHaveLength(1);
  });

  it("marks two steps done for stitching", () => {
    render(<ProgressTracker status="stitching" />);
    expect(screen.getAllByText("✓")).toHaveLength(2);
  });

  it("treats hemming_hook the same as stitching for step position", () => {
    render(<ProgressTracker status="hemming_hook" />);
    expect(screen.getAllByText("✓")).toHaveLength(2);
  });

  it("marks three steps done for ready", () => {
    render(<ProgressTracker status="ready" />);
    expect(screen.getAllByText("✓")).toHaveLength(3);
  });

  it("marks four steps done for delivered and renders a connector between every step", () => {
    const { container } = render(<ProgressTracker status="delivered" />);
    expect(screen.getAllByText("✓")).toHaveLength(4);
    const connectors = container.querySelectorAll(".h-\\[3px\\]");
    expect(connectors).toHaveLength(4);
  });
});
