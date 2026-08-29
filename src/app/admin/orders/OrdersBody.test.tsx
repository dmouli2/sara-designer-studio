import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrdersBody from "./OrdersBody";
import { ORDERS_PAGE_SIZE } from "./pageSize";
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
    advanceMethod: null,
    finalPayment: 0,
    finalPaymentMethod: null,
    due: "2026-07-10",
    master: null,
    tailor: null,
    measurements: { type: "generic", bust: "", waist: "", hip: "", length: "", shoulder: "", sleeve: "", neckDepth: "", armRound: "" },
    lineItems: [],
    notes: "",
    sketchDataUrl: null,
    referenceImageUrls: [],
    materialImageUrls: [],
    mainMaterialImageUrl: null,
    cancellationCharge: null,
    pieces: null,
    alterations: [],
    payments: [],
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

const mixedBooks: Order[] = [
  order({ id: "B2505", dress: "Blouse", customer: "Priya",   status: "new",     due: "2999-01-01" }),
  order({ id: "B2504", dress: "Blouse", customer: "Dharshini", status: "cutting", due: "2999-01-01" }),
  order({ id: "S2202", dress: "Salwar", customer: "Lavanya", status: "new",     due: "2999-01-01" }),
  order({ id: "S2201", dress: "Salwar", customer: "Kavya",   status: "ready",   due: "2999-01-01" }),
];

describe("OrdersBody", () => {
  beforeEach(() => {
    vi.mocked(getOrders).mockReset();
  });

  describe("Blouse / Salwar tabs", () => {
    // The shop runs two separate order books (S… / B…), so the list splits
    // the same way. The tabs compose with the status chips and the search
    // box rather than replacing them.
    it("shows every book under All, with a count on each tab", () => {
      render(<OrdersBody initialOrders={mixedBooks} />);

      expect(screen.getByRole("tab", { name: /All/ })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: /All/ })).toHaveTextContent("4");
      expect(screen.getByRole("tab", { name: /Blouse/ })).toHaveTextContent("2");
      expect(screen.getByRole("tab", { name: /Salwar/ })).toHaveTextContent("2");
      expect(screen.getByText("B2505")).toBeInTheDocument();
      expect(screen.getByText("S2201")).toBeInTheDocument();
    });

    it("narrows to one book when its tab is selected", async () => {
      const user = userEvent.setup();
      render(<OrdersBody initialOrders={mixedBooks} />);

      await user.click(screen.getByRole("tab", { name: /Salwar/ }));

      expect(screen.getByText("S2202")).toBeInTheDocument();
      expect(screen.getByText("S2201")).toBeInTheDocument();
      expect(screen.queryByText("B2505")).not.toBeInTheDocument();
      expect(screen.queryByText("B2504")).not.toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: /Blouse/ }));

      expect(screen.getByText("B2505")).toBeInTheDocument();
      expect(screen.queryByText("S2201")).not.toBeInTheDocument();
    });

    it("composes with the status chips", async () => {
      const user = userEvent.setup();
      render(<OrdersBody initialOrders={mixedBooks} />);

      await user.click(screen.getByRole("tab", { name: /Blouse/ }));
      await user.click(screen.getByRole("button", { name: "New" }));

      expect(screen.getByText("B2505")).toBeInTheDocument();
      expect(screen.queryByText("B2504")).not.toBeInTheDocument(); // cutting
      expect(screen.queryByText("S2202")).not.toBeInTheDocument(); // salwar + new
    });

    // A count that disagrees with the list it opens is worse than no count,
    // so each tab counts what tapping it would actually show.
    it("recounts the tabs against the active status filter and search", async () => {
      const user = userEvent.setup();
      render(<OrdersBody initialOrders={mixedBooks} />);

      await user.click(screen.getByRole("button", { name: "New" }));

      expect(screen.getByRole("tab", { name: /All/ })).toHaveTextContent("2");
      expect(screen.getByRole("tab", { name: /Blouse/ })).toHaveTextContent("1");
      expect(screen.getByRole("tab", { name: /Salwar/ })).toHaveTextContent("1");

      await user.type(screen.getByLabelText("Search orders"), "Lavanya");

      expect(screen.getByRole("tab", { name: /Blouse/ })).toHaveTextContent("0");
      expect(screen.getByRole("tab", { name: /Salwar/ })).toHaveTextContent("1");
    });

    it("names the book in the empty state", async () => {
      const user = userEvent.setup();
      render(<OrdersBody initialOrders={[order({ id: "B1", dress: "Blouse", due: "2999-01-01" })]} />);

      await user.click(screen.getByRole("tab", { name: /Salwar/ }));

      expect(screen.getByText("No Salwar orders found")).toBeInTheDocument();
    });

    // An order whose dress is neither (legacy rows) must stay reachable.
    it("keeps an order of some other dress type visible under All", async () => {
      const user = userEvent.setup();
      render(<OrdersBody initialOrders={[order({ id: "X1", dress: "Lehenga", due: "2999-01-01" })]} />);

      expect(screen.getByText("X1")).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /All/ })).toHaveTextContent("1");
      expect(screen.getByRole("tab", { name: /Blouse/ })).toHaveTextContent("0");

      await user.click(screen.getByRole("tab", { name: /Blouse/ }));
      expect(screen.queryByText("X1")).not.toBeInTheDocument();
    });
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
    // Due dates far in the future so the subtitle can't flip to the
    // "N active · N overdue" variant as real time passes.
    const withCancelled = [
      order({ id: "C1", status: "new", due: "2999-01-01" }),
      order({ id: "C2", status: "cancelled", due: "2999-01-01" }),
      order({ id: "C3", status: "delivered", due: "2999-01-01" }),
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

  // The list that answers "which orders still have garments on my shelf?" —
  // it sits with Overdue and In Alteration, ahead of the pipeline stages,
  // because it is a thing that needs chasing rather than a stage of work.
  describe("finding orders with garments still to collect", () => {
    const PARTLY = order({
      id: "P1",
      customer: "Kavitha",
      status: "partly_delivered",
      pieces: [
        { id: "p1", label: "Blouse 1", due: "2026-07-10", status: "delivered", deliveredAt: "2026-07-10T00:00:00Z" },
        { id: "p2", label: "Blouse 2", due: "2026-07-20", status: "pending", deliveredAt: null },
        { id: "p3", label: "Blouse 3", due: "2026-07-25", status: "pending", deliveredAt: null },
      ],
    });

    it("filters the list down to part-delivered orders", async () => {
      const user = userEvent.setup();
      render(<OrdersBody initialOrders={[PARTLY, order({ id: "C2", customer: "Meena" })]} />);

      await user.click(screen.getByRole("button", { name: /Part Delivered/ }));

      expect(screen.getByText("Kavitha")).toBeInTheDocument();
      expect(screen.queryByText("Meena")).not.toBeInTheDocument();
    });

    it("shows the delivered count on the card without opening it", () => {
      render(<OrdersBody initialOrders={[PARTLY]} />);
      expect(screen.getByText("👗 1/3 delivered")).toBeInTheDocument();
    });

    it("counts a split order overdue on its earliest waiting garment", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-22T10:00:00"));
      // order.due is 2026-07-10 for the fixture, but the garments still here
      // are due on the 20th and 25th — the 20th is what has actually slipped.
      render(<OrdersBody initialOrders={[PARTLY]} />);
      expect(screen.getByText(/was due 20 Jul 2026/)).toBeInTheDocument();
      vi.useRealTimers();
    });
  });

});
