import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ReportSummaryCards from "./ReportSummaryCards";
import type { ReportSummary } from "@/lib/reports";

const summary: ReportSummary = {
  totalOrders: 12,
  active: 5,
  ready: 2,
  delivered: 4,
  totalRevenue: 45000,
  pendingBalance: 8000,
};

describe("ReportSummaryCards", () => {
  it("renders every count and formats currency values", () => {
    render(<ReportSummaryCards summary={summary} />);
    expect(screen.getByText("Total Orders").previousSibling).toHaveTextContent("12");
    expect(screen.getByText("Active").previousSibling).toHaveTextContent("5");
    expect(screen.getByText("Ready Pickup").previousSibling).toHaveTextContent("2");
    expect(screen.getByText("Delivered").previousSibling).toHaveTextContent("4");
    expect(screen.getByText("Total Revenue").previousSibling).toHaveTextContent("₹45,000");
    expect(screen.getByText("Pending Balance").previousSibling).toHaveTextContent("₹8,000");
  });
});
