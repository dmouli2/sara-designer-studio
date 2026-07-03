import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
    referenceImageUrls: [],
    cancellationCharge: null,
    createdAt: "2026-06-01",
    ...overrides,
  };
}

const orders: Order[] = [
  order({ id: "C1", status: "new", amount: 1000 }),
  order({ id: "C2", status: "ready", amount: 2000 }),
  order({ id: "C3", status: "delivered", amount: 3000 }),
];

const ordersWithStaffAndDates: Order[] = [
  order({
    id: "D1",
    status: "cutting",
    master: { id: "m1", name: "Ramesh K." },
    tailor: null,
    due: "2026-07-05",
    createdAt: "2026-06-01",
  }),
  order({
    id: "D2",
    status: "stitching",
    master: { id: "m2", name: "Suresh P." },
    tailor: { id: "t1", name: "Anitha K." },
    due: "2026-07-20",
    createdAt: "2026-06-15",
  }),
];

describe("OrdersBody", () => {
  it("shows all orders under the All filter", () => {
    render(<OrdersBody orders={orders} />);
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

  it("navigates to the reports page when the Reports tab is clicked", async () => {
    const user = userEvent.setup();
    render(<OrdersBody orders={orders} />);
    await user.click(screen.getByText("Reports"));
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/reports");
  });

  it("does not navigate when the already-active Orders tab is clicked", async () => {
    const user = userEvent.setup();
    render(<OrdersBody orders={orders} />);
    await user.click(screen.getByText("Orders"));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("opens the filter sheet and filters by assigned master", async () => {
    const user = userEvent.setup();
    render(<OrdersBody orders={ordersWithStaffAndDates} />);

    await user.click(screen.getByLabelText("More filters"));
    expect(screen.getByText("Filter orders")).toBeInTheDocument();

    await user.click(screen.getByText("Ramesh K."));
    expect(screen.getByText("D1")).toBeInTheDocument();
    expect(screen.queryByText("D2")).not.toBeInTheDocument();
  });

  it("filters by assigned tailor", async () => {
    const user = userEvent.setup();
    render(<OrdersBody orders={ordersWithStaffAndDates} />);

    await user.click(screen.getByLabelText("More filters"));
    await user.click(screen.getByText("Anitha K."));
    expect(screen.getByText("D2")).toBeInTheDocument();
    expect(screen.queryByText("D1")).not.toBeInTheDocument();
  });

  it("filters by an exact due date", async () => {
    const user = userEvent.setup();
    render(<OrdersBody orders={ordersWithStaffAndDates} />);

    await user.click(screen.getByLabelText("More filters"));
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-07-20" } });
    expect(screen.getByText("D2")).toBeInTheDocument();
    expect(screen.queryByText("D1")).not.toBeInTheDocument();
  });

  it("shows an active-filter indicator and clears all advanced filters", async () => {
    const user = userEvent.setup();
    render(<OrdersBody orders={ordersWithStaffAndDates} />);

    await user.click(screen.getByLabelText("More filters"));
    await user.click(screen.getByText("Ramesh K."));
    expect(screen.queryByText("D2")).not.toBeInTheDocument();

    await user.click(screen.getByText("Clear all"));
    expect(screen.getByText("D1")).toBeInTheDocument();
    expect(screen.getByText("D2")).toBeInTheDocument();
  });

  it("searches by customer name", async () => {
    const user = userEvent.setup();
    const named = [
      order({ id: "N1", customer: "Priya Sharma", phone: "9876543210" }),
      order({ id: "N2", customer: "Anita Rao", phone: "9123456780" }),
    ];
    render(<OrdersBody orders={named} />);

    await user.type(screen.getByLabelText("Search orders"), "priya");
    expect(screen.getByText("N1")).toBeInTheDocument();
    expect(screen.queryByText("N2")).not.toBeInTheDocument();
  });

  it("searches by mobile number", async () => {
    const user = userEvent.setup();
    const named = [
      order({ id: "N1", customer: "Priya Sharma", phone: "9876543210" }),
      order({ id: "N2", customer: "Anita Rao", phone: "9123456780" }),
    ];
    render(<OrdersBody orders={named} />);

    await user.type(screen.getByLabelText("Search orders"), "91234");
    expect(screen.getByText("N2")).toBeInTheDocument();
    expect(screen.queryByText("N1")).not.toBeInTheDocument();
  });

  it("closes the filter sheet via Done", async () => {
    const user = userEvent.setup();
    render(<OrdersBody orders={ordersWithStaffAndDates} />);

    await user.click(screen.getByLabelText("More filters"));
    expect(screen.getByText("Filter orders")).toBeInTheDocument();
    await user.click(screen.getByText("Done"));
    expect(screen.queryByText("Filter orders")).not.toBeInTheDocument();
  });

  it("navigates to the staff and logout pages via the top bar actions", async () => {
    const user = userEvent.setup();
    render(<OrdersBody orders={orders} />);

    await user.click(screen.getByLabelText("Staff"));
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/staff");

    await user.click(screen.getByLabelText("Log out"));
    expect(mockRouter.push).toHaveBeenCalledWith("/logout");
  });

  it("navigates to the new-order page via the floating action button", async () => {
    const user = userEvent.setup();
    render(<OrdersBody orders={orders} />);

    await user.click(screen.getByLabelText("New order"));
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders/new");
  });
});
