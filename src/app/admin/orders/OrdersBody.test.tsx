import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrdersBody, { ORDERS_PAGE_SIZE } from "./OrdersBody";
import { getOrders } from "@/app/actions/orders";
import { mockRouter } from "../../../../vitest.setup";
import type { Order } from "@/types";

vi.mock("@/app/actions/orders", () => ({
  getOrders: vi.fn(),
}));

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
  beforeEach(() => {
    vi.mocked(getOrders).mockReset();
  });

  it("shows all orders under the All filter", () => {
    render(<OrdersBody initialOrders={orders} />);
    expect(screen.getByText("C1")).toBeInTheDocument();
    expect(screen.getByText("C2")).toBeInTheDocument();
    expect(screen.getByText("C3")).toBeInTheDocument();
  });

  it("filters the order list when a status chip is clicked", async () => {
    const user = userEvent.setup();
    render(<OrdersBody initialOrders={orders} />);
    await user.click(screen.getByRole("button", { name: "Ready" }));
    expect(screen.getByText("C2")).toBeInTheDocument();
    expect(screen.queryByText("C1")).not.toBeInTheDocument();
    expect(screen.queryByText("C3")).not.toBeInTheDocument();
  });

  it("shows an empty state when no orders match the filter", async () => {
    const user = userEvent.setup();
    render(<OrdersBody initialOrders={orders} />);
    await user.click(screen.getByText("Stitching"));
    expect(screen.getByText("No orders found")).toBeInTheDocument();
  });

  it("navigates to the order detail page when a card is clicked", async () => {
    const user = userEvent.setup();
    render(<OrdersBody initialOrders={orders} />);
    await user.click(screen.getByText("C1").closest(".card")!);
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders/C1");
  });

  it("navigates to the reports page when the Reports tab is clicked", async () => {
    const user = userEvent.setup();
    render(<OrdersBody initialOrders={orders} />);
    await user.click(screen.getByText("Reports"));
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/reports");
  });

  it("does not navigate when the already-active Orders tab is clicked", async () => {
    const user = userEvent.setup();
    render(<OrdersBody initialOrders={orders} />);
    await user.click(screen.getByText("Orders"));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("opens the filter sheet and filters by assigned master", async () => {
    const user = userEvent.setup();
    render(<OrdersBody initialOrders={ordersWithStaffAndDates} />);

    await user.click(screen.getByLabelText("More filters"));
    expect(screen.getByText("Filter orders")).toBeInTheDocument();

    await user.click(screen.getByText("Ramesh K."));
    expect(screen.getByText("D1")).toBeInTheDocument();
    expect(screen.queryByText("D2")).not.toBeInTheDocument();
  });

  it("filters by assigned tailor", async () => {
    const user = userEvent.setup();
    render(<OrdersBody initialOrders={ordersWithStaffAndDates} />);

    await user.click(screen.getByLabelText("More filters"));
    await user.click(screen.getByText("Anitha K."));
    expect(screen.getByText("D2")).toBeInTheDocument();
    expect(screen.queryByText("D1")).not.toBeInTheDocument();
  });

  it("filters by an exact due date", async () => {
    const user = userEvent.setup();
    render(<OrdersBody initialOrders={ordersWithStaffAndDates} />);

    await user.click(screen.getByLabelText("More filters"));
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-07-20" } });
    expect(screen.getByText("D2")).toBeInTheDocument();
    expect(screen.queryByText("D1")).not.toBeInTheDocument();
  });

  it("shows an active-filter indicator and clears all advanced filters", async () => {
    const user = userEvent.setup();
    render(<OrdersBody initialOrders={ordersWithStaffAndDates} />);

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
    render(<OrdersBody initialOrders={named} />);

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
    render(<OrdersBody initialOrders={named} />);

    await user.type(screen.getByLabelText("Search orders"), "91234");
    expect(screen.getByText("N2")).toBeInTheDocument();
    expect(screen.queryByText("N1")).not.toBeInTheDocument();
  });

  it("closes the filter sheet via Done", async () => {
    const user = userEvent.setup();
    render(<OrdersBody initialOrders={ordersWithStaffAndDates} />);

    await user.click(screen.getByLabelText("More filters"));
    expect(screen.getByText("Filter orders")).toBeInTheDocument();
    await user.click(screen.getByText("Done"));
    expect(screen.queryByText("Filter orders")).not.toBeInTheDocument();
  });

  it("navigates to the staff and logout pages via the top bar actions", async () => {
    const user = userEvent.setup();
    render(<OrdersBody initialOrders={orders} />);

    await user.click(screen.getByLabelText("Staff"));
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/staff");

    await user.click(screen.getByLabelText("Log out"));
    expect(mockRouter.push).toHaveBeenCalledWith("/logout");
  });

  it("navigates to the new-order page via the floating action button", async () => {
    const user = userEvent.setup();
    render(<OrdersBody initialOrders={orders} />);

    await user.click(screen.getByLabelText("New order"));
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders/new");
  });

  it("excludes cancelled orders from the active count", () => {
    const withCancelled = [
      order({ id: "C1", status: "new" }),
      order({ id: "C2", status: "cancelled" }),
      order({ id: "C3", status: "delivered" }),
    ];
    render(<OrdersBody initialOrders={withCancelled} />);
    expect(screen.getByText("1 active orders")).toBeInTheDocument();
  });

  it("filters by the Cancelled and Cutting Done chips", async () => {
    const user = userEvent.setup();
    const mixed = [
      order({ id: "C1", status: "cutting_done" }),
      order({ id: "C2", status: "cancelled" }),
    ];
    render(<OrdersBody initialOrders={mixed} />);

    await user.click(screen.getByRole("button", { name: "Cutting Done" }));
    expect(screen.getByText("C1")).toBeInTheDocument();
    expect(screen.queryByText("C2")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelled" }));
    expect(screen.getByText("C2")).toBeInTheDocument();
    expect(screen.queryByText("C1")).not.toBeInTheDocument();
  });

  it("filters to overdue orders and shows the overdue count in the subtitle", async () => {
    const user = userEvent.setup();
    const mixed = [
      order({ id: "C1", status: "cutting", due: "2020-01-01" }),
      order({ id: "C2", status: "cutting", due: "2099-01-01" }),
      // Past due but delivered — not overdue.
      order({ id: "C3", status: "delivered", due: "2020-01-01" }),
    ];
    render(<OrdersBody initialOrders={mixed} />);

    expect(screen.getByText("2 active · 1 overdue")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Overdue" }));
    expect(screen.getByText("C1")).toBeInTheDocument();
    expect(screen.queryByText("C2")).not.toBeInTheDocument();
    expect(screen.queryByText("C3")).not.toBeInTheDocument();
  });

  it("hides the load-older button when the first page came back short", () => {
    render(<OrdersBody initialOrders={orders} />);
    expect(screen.queryByText("Load older orders")).not.toBeInTheDocument();
  });

  it("loads older orders on demand and stops when a short page arrives", async () => {
    const user = userEvent.setup();
    const fullPage = Array.from({ length: ORDERS_PAGE_SIZE }, (_, i) =>
      order({ id: `P${i}`, customer: `Customer ${i}` })
    );
    vi.mocked(getOrders).mockResolvedValue([order({ id: "OLD1", customer: "Old Customer" })]);
    render(<OrdersBody initialOrders={fullPage} />);

    await user.click(screen.getByText("Load older orders"));
    expect(getOrders).toHaveBeenCalledWith({ limit: ORDERS_PAGE_SIZE, offset: ORDERS_PAGE_SIZE });
    expect(await screen.findByText("OLD1")).toBeInTheDocument();
    // The follow-up page was short, so there is nothing more to load.
    expect(screen.queryByText("Load older orders")).not.toBeInTheDocument();
  });

  it("keeps the button and shows an error toast when loading older orders fails", async () => {
    const user = userEvent.setup();
    const fullPage = Array.from({ length: ORDERS_PAGE_SIZE }, (_, i) => order({ id: `P${i}` }));
    vi.mocked(getOrders).mockRejectedValue(new Error("offline"));
    render(<OrdersBody initialOrders={fullPage} />);

    await user.click(screen.getByText("Load older orders"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load older orders");
    expect(screen.getByText("Load older orders")).toBeInTheDocument();
  });

  it("dedupes an order that appears in both the refreshed first page and an older page", async () => {
    const user = userEvent.setup();
    const fullPage = Array.from({ length: ORDERS_PAGE_SIZE }, (_, i) => order({ id: `P${i}` }));
    // P0 shifted into the older page because a new order arrived meanwhile.
    vi.mocked(getOrders).mockResolvedValue([fullPage[0]]);
    render(<OrdersBody initialOrders={fullPage} />);

    await user.click(screen.getByText("Load older orders"));
    expect(await screen.findAllByText("P0")).toHaveLength(1);
  });
});
