import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PaymentsSummaryChart from "./PaymentsSummaryChart";

describe("PaymentsSummaryChart", () => {
  it("shows an empty state when there is no advance or balance", () => {
    render(<PaymentsSummaryChart payments={{ advanceCollected: 0, collectedOnDelivery: 0, balanceDue: 0 }} />);
    expect(screen.getByText("No orders in this period")).toBeInTheDocument();
  });

  it("renders the chart when there is payment data", () => {
    const { container } = render(<PaymentsSummaryChart payments={{ advanceCollected: 5000, collectedOnDelivery: 0, balanceDue: 2000 }} />);
    expect(screen.getByText("Advance Collected vs Balance Due")).toBeInTheDocument();
    expect(screen.queryByText("No orders in this period")).not.toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
