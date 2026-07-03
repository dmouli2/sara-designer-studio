import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StaffOrderCountsChart from "./StaffOrderCountsChart";

describe("StaffOrderCountsChart", () => {
  it("shows the given title and an empty state when there is no staff data", () => {
    render(<StaffOrderCountsChart title="Orders per Master" staff={[]} />);
    expect(screen.getByText("Orders per Master")).toBeInTheDocument();
    expect(screen.getByText("No orders in this period")).toBeInTheDocument();
  });

  it("renders the chart when staff order counts are present", () => {
    const { container } = render(
      <StaffOrderCountsChart
        title="Orders per Tailor"
        staff={[
          { name: "Anitha K.", count: 4 },
          { name: "Unassigned", count: 1 },
        ]}
      />
    );
    expect(screen.getByText("Orders per Tailor")).toBeInTheDocument();
    expect(screen.queryByText("No orders in this period")).not.toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
