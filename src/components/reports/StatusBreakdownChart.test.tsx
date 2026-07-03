import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBreakdownChart from "./StatusBreakdownChart";

describe("StatusBreakdownChart", () => {
  it("shows an empty state when there are no statuses", () => {
    render(<StatusBreakdownChart statuses={[]} />);
    expect(screen.getByText("No orders in this period")).toBeInTheDocument();
  });

  it("renders the chart when statuses are present", () => {
    const { container } = render(
      <StatusBreakdownChart
        statuses={[
          { status: "new", label: "New", count: 3 },
          { status: "ready", label: "Ready", count: 1 },
        ]}
      />
    );
    expect(screen.getByText("Orders by Status")).toBeInTheDocument();
    expect(screen.queryByText("No orders in this period")).not.toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
