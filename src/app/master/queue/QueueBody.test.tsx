import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QueueBody from "./QueueBody";
import { mockRouter } from "../../../../vitest.setup";
import type { Order } from "@/types";

function order(overrides: Partial<Order>): Order {
  return {
    id: "A1",
    customer: "Priya",
    phone: "999",
    dress: "Blouse",
    material: "Silk",
    status: "new",
    amount: 1000,
    advance: 0,
    advanceMethod: null,
    finalPayment: 0,
    finalPaymentMethod: null,
    due: "2026-07-10",
    master: { id: "m1", name: "Ramesh K." },
    tailor: null,
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
    createdAt: "2026-06-01",
    ...overrides,
  };
}

describe("QueueBody", () => {
  it("shows an empty state when there are no assigned orders", () => {
    render(<QueueBody myOrders={[]} doneOrders={[]} />);
    expect(screen.getByText("No orders assigned yet")).toBeInTheDocument();
  });

  it("uses singular wording when exactly one order is active", () => {
    render(<QueueBody myOrders={[order({ id: "A1" })]} doneOrders={[]} />);
    expect(screen.getByText("1 order to cut")).toBeInTheDocument();
  });

  it("shows only active orders on the Queue tab, not cutting-done ones", async () => {
    const user = userEvent.setup();
    render(
      <QueueBody
        myOrders={[order({ id: "A1", status: "new" }), order({ id: "A2", status: "cutting" })]}
        doneOrders={[order({ id: "A3", status: "cutting_done" })]}
      />
    );

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText("A2")).toBeInTheDocument();
    expect(screen.queryByText("A3")).not.toBeInTheDocument();

    await user.click(screen.getByText("A1").closest(".card")!);
    expect(mockRouter.push).toHaveBeenCalledWith("/master/orders/A1");
  });

  it("moves an order to the Completed tab once cutting is marked done, out of the Queue tab", async () => {
    const user = userEvent.setup();
    render(
      <QueueBody
        myOrders={[order({ id: "A1", status: "new" })]}
        doneOrders={[order({ id: "A3", status: "cutting_done" })]}
      />
    );

    expect(screen.queryByText("A3")).not.toBeInTheDocument();

    await user.click(screen.getByText("Completed"));
    expect(screen.getByText("Cutting done — awaiting tailor")).toBeInTheDocument();
    expect(screen.getByText("A3")).toBeInTheDocument();
    expect(screen.queryByText("A1")).not.toBeInTheDocument();

    await user.click(screen.getByText("A3").closest(".card")!);
    expect(mockRouter.push).toHaveBeenCalledWith("/master/orders/A3");
  });

  it("shows an empty state on the Completed tab when nothing is done yet", async () => {
    const user = userEvent.setup();
    render(<QueueBody myOrders={[order({ id: "A1" })]} doneOrders={[]} />);
    await user.click(screen.getByText("Completed"));
    expect(screen.getByText("No completed orders yet")).toBeInTheDocument();
  });

  it("navigates to /logout from the top bar action", async () => {
    const user = userEvent.setup();
    const { container } = render(<QueueBody myOrders={[]} doneOrders={[]} />);
    const logoutBtn = container.querySelector(".lucide-log-out")!.closest("button")!;
    await user.click(logoutBtn);
    expect(mockRouter.push).toHaveBeenCalledWith("/logout");
  });

  it("filters the queue by customer search and shows a no-match state", async () => {
    const user = userEvent.setup();
    render(
      <QueueBody
        myOrders={[
          order({ id: "A1", customer: "Priya Sharma" }),
          order({ id: "A2", customer: "Anita Rao" }),
        ]}
        doneOrders={[]}
      />
    );

    await user.type(screen.getByLabelText("Search orders"), "priya");
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.queryByText("A2")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search orders"));
    await user.type(screen.getByLabelText("Search orders"), "nobody");
    expect(screen.getByText("No orders match your search")).toBeInTheDocument();
  });

  it("applies the search to the Completed tab too", async () => {
    const user = userEvent.setup();
    render(
      <QueueBody
        myOrders={[]}
        doneOrders={[
          order({ id: "A3", customer: "Priya Sharma", status: "cutting_done" }),
          order({ id: "A4", customer: "Anita Rao", status: "cutting_done" }),
        ]}
      />
    );

    await user.click(screen.getByText("Completed"));
    await user.type(screen.getByLabelText("Search orders"), "anita");
    expect(screen.getByText("A4")).toBeInTheDocument();
    expect(screen.queryByText("A3")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search orders"));
    await user.type(screen.getByLabelText("Search orders"), "nobody");
    expect(screen.getByText("No orders match your search")).toBeInTheDocument();
  });
});
