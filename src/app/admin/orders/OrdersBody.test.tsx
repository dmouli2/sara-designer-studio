import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrdersBody from "./OrdersBody";
import { mockRouter } from "../../../../vitest.setup";
import type { Order } from "@/types";

function order(overrides: Partial<Order>): Order {
  return {
    id: "C1",
    customer: "Priya",
    phone: "999",
    dress: "Blouse",
    material: "Silk",
    status: "new",
    amount: 1000,
    advance: 300,
    due: "2026-07-10",
    master: null,
    tailor: null,
    measurements: { type: "generic", bust: "", waist: "", hip: "", length: "", shoulder: "", sleeve: "", neckDepth: "", armRound: "" },
    lineItems: [],
    notes: "",
    sketchDataUrl: null,
    referenceImageUrl: null,
    createdAt: "2026-06-01",
    ...overrides,
  };
}

const orders: Order[] = [
  order({ id: "C1", status: "new", amount: 1000 }),
  order({ id: "C2", status: "ready", amount: 2000 }),
  order({ id: "C3", status: "delivered", amount: 3000 }),
];

describe("OrdersBody", () => {
  it("shows summary stats and all orders under the All filter", () => {
    render(<OrdersBody orders={orders} />);
    expect(screen.getByText("3")).toBeInTheDocument(); // total
    expect(screen.getByText("C1")).toBeInTheDocument();
    expect(screen.getByText("C2")).toBeInTheDocument();
    expect(screen.getByText("C3")).toBeInTheDocument();
  });

  it("filters the order list when a status chip is clicked", async () => {
    const user = userEvent.setup();
    render(<OrdersBody orders={orders} />);
    await user.click(screen.getByRole("button", { name: "Ready" }));
    expect(screen.getByText("C2")).toBeInTheDocument();
    expect(screen.queryByText("C1")).not.toBeInTheDocument();
    expect(screen.queryByText("C3")).not.toBeInTheDocument();
  });

  it("shows an empty state when no orders match the filter", async () => {
    const user = userEvent.setup();
    render(<OrdersBody orders={orders} />);
    await user.click(screen.getByText("Stitching"));
    expect(screen.getByText("No orders found")).toBeInTheDocument();
  });

  it("navigates to the order detail page when a card is clicked", async () => {
    const user = userEvent.setup();
    render(<OrdersBody orders={orders} />);
    await user.click(screen.getByText("C1").closest(".card")!);
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders/C1");
  });

  it("does not crash when the inactive bottom nav tab is clicked", async () => {
    const user = userEvent.setup();
    render(<OrdersBody orders={orders} />);
    await user.click(screen.getByText("Reports"));
    expect(screen.getByText("C1")).toBeInTheDocument();
  });

  it("navigates to the new-order page, logout and staff pages via the top bar actions", async () => {
    const user = userEvent.setup();
    render(<OrdersBody orders={orders} />);
    const buttons = screen.getAllByRole("button").filter((b) => !b.className.includes("flex-none"));
    const [newOrderBtn, logoutBtn, staffBtn] = buttons;
    await user.click(newOrderBtn);
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders/new");
    await user.click(logoutBtn);
    expect(mockRouter.push).toHaveBeenCalledWith("/logout");
    await user.click(staffBtn);
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/staff");
  });
});
