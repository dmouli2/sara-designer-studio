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

  // Money owed is the one figure on this screen that asks the owner to do
  // something, so it is coloured only while there is something to collect.
  it("marks the pending balance as owed only when there is one", () => {
    render(<ReportSummaryCards summary={summary} />);
    expect(screen.getByText("Pending Balance")).toHaveClass("text-danger-ink");
  });

  it("leaves a settled balance in the neutral colour", () => {
    render(<ReportSummaryCards summary={{ ...summary, pendingBalance: 0 }} />);
    const label = screen.getByText("Pending Balance");
    expect(label).toHaveClass("text-fg-2");
    expect(label.previousSibling).toHaveTextContent("₹0");
  });
});
