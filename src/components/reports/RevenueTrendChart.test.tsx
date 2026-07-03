import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RevenueTrendChart from "./RevenueTrendChart";

describe("RevenueTrendChart", () => {
  it("shows an empty state when there are no points", () => {
    render(<RevenueTrendChart points={[]} />);
    expect(screen.getByText("No orders in this period")).toBeInTheDocument();
  });

  it("renders a chart title and axis labels when points are present", () => {
    const { container } = render(
      <RevenueTrendChart
        points={[
          { label: "1 Jul", revenue: 1000 },
          { label: "2 Jul", revenue: 2000 },
        ]}
      />
    );
    expect(screen.getByText("Revenue Trend")).toBeInTheDocument();
    expect(screen.queryByText("No orders in this period")).not.toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
