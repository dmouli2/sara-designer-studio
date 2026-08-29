import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportsBody from "./ReportsBody";
import { mockRouter } from "../../../../vitest.setup";
import type { Order } from "@/types";

const today = new Date().toISOString();

function order(overrides: Partial<Order>): Order {
  return {
    id: "SDS-001",
    customer: "Priya",
    phone: "9876543210",
    dress: "Blouse",
    material: "Silk",
    status: "new",
    amount: 1000,
    advance: 300,
    advanceMethod: null,
    advanceSplit: null,
    finalPayment: 0,
    finalPaymentMethod: null,
    due: "2026-07-20",
    master: { id: "m1", name: "Ramesh K." },
    tailor: { id: "t1", name: "Anitha K." },
    measurements: { type: "generic", bust: "", waist: "", hip: "", length: "", shoulder: "", sleeve: "", neckDepth: "", armRound: "" },
    lineItems: [],
    notes: "",
    sketchDataUrl: null,
    referenceImageUrls: [],
    materialImageUrls: [],
    mainMaterialImageUrl: null,
    cancellationCharge: null,
    deliveredOn: null,
    pieces: null,
    alterations: [],
    payments: [],
    createdAt: today,
    ...overrides,
  };
}

describe("ReportsBody", () => {
  it("renders the header and links back to the order list", () => {
    render(<ReportsBody orders={[]} />);
    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/admin/orders");
  });

  it("aggregates orders created within the default This Month range into the summary cards", () => {
    const orders = [
      order({ id: "A", status: "new", amount: 1000, advance: 300 }),
      order({ id: "B", status: "ready", amount: 2000, advance: 2000 }),
    ];
    render(<ReportsBody orders={orders} />);
    expect(screen.getByText("Total Orders").previousSibling).toHaveTextContent("2");
    expect(screen.getByText("Ready Pickup").previousSibling).toHaveTextContent("1");
  });

  it("excludes orders outside the selected range and includes them again under All Time", async () => {
    const user = userEvent.setup();
    const orders = [
      order({ id: "OLD", createdAt: "2020-01-01T00:00:00.000Z" }),
    ];
    render(<ReportsBody orders={orders} />);
    expect(screen.getByText("Total Orders").previousSibling).toHaveTextContent("0");

    await user.click(screen.getByText("All Time"));
    expect(screen.getByText("Total Orders").previousSibling).toHaveTextContent("1");
  });

  it("renders all report sections", () => {
    render(<ReportsBody orders={[order({})]} />);
    expect(screen.getByText("Revenue Trend")).toBeInTheDocument();
    expect(screen.getByText("Orders by Status")).toBeInTheDocument();
    expect(screen.getByText("Advance Collected vs Balance Due")).toBeInTheDocument();
    expect(screen.getByText("Revenue by Dress Type")).toBeInTheDocument();
    expect(screen.getByText("Orders per Master")).toBeInTheDocument();
    expect(screen.getByText("Orders per Tailor")).toBeInTheDocument();
  });

  it("navigates to the order list when the Orders tab is clicked", async () => {
    const user = userEvent.setup();
    render(<ReportsBody orders={[]} />);
    await user.click(screen.getByText("Orders"));
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders");
  });

  it("does not navigate when the already-active Reports tab is clicked", async () => {
    const user = userEvent.setup();
    render(<ReportsBody orders={[]} />);
    const reportsTab = screen.getAllByText("Reports").find((el) => el.closest(".bottom-nav"))!;
    await user.click(reportsTab);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
