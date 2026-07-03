import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DressTypeRevenueChart from "./DressTypeRevenueChart";

describe("DressTypeRevenueChart", () => {
  it("shows an empty state when there is no dress revenue data", () => {
    render(<DressTypeRevenueChart dresses={[]} />);
    expect(screen.getByText("No orders in this period")).toBeInTheDocument();
  });

  it("renders the chart when dress revenue data is present", () => {
    const { container } = render(
      <DressTypeRevenueChart
        dresses={[
          { dress: "Blouse", revenue: 5000 },
          { dress: "Salwar", revenue: 3000 },
        ]}
      />
    );
    expect(screen.getByText("Revenue by Dress Type")).toBeInTheDocument();
    expect(screen.queryByText("No orders in this period")).not.toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
