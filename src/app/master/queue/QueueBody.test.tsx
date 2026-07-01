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
    due: "2026-07-10",
    master: { id: "m1", name: "Ramesh K." },
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

describe("QueueBody", () => {
  it("shows an empty state when there are no assigned orders", () => {
    render(<QueueBody myOrders={[]} doneOrders={[]} />);
    expect(screen.getByText("No orders assigned yet")).toBeInTheDocument();
  });

  it("uses singular wording when exactly one order is active", () => {
    render(<QueueBody myOrders={[order({ id: "A1" })]} doneOrders={[]} />);
    expect(screen.getByText("1 order to cut")).toBeInTheDocument();
  });

  it("lists active and cutting-done orders in separate sections and navigates on click", async () => {
    const user = userEvent.setup();
    render(
      <QueueBody
        myOrders={[order({ id: "A1", status: "new" }), order({ id: "A2", status: "cutting" })]}
        doneOrders={[order({ id: "A3", status: "cutting_done" })]}
      />
    );

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Cutting done — awaiting tailor")).toBeInTheDocument();
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText("A2")).toBeInTheDocument();
    expect(screen.getByText("A3")).toBeInTheDocument();

    await user.click(screen.getByText("A1").closest(".card")!);
    expect(mockRouter.push).toHaveBeenCalledWith("/master/orders/A1");

    await user.click(screen.getByText("A3").closest(".card")!);
    expect(mockRouter.push).toHaveBeenCalledWith("/master/orders/A3");
  });

  it("does not crash when the inactive bottom nav tab is clicked", async () => {
    const user = userEvent.setup();
    render(<QueueBody myOrders={[]} doneOrders={[]} />);
    await user.click(screen.getByText("Completed"));
    expect(screen.getByText("No orders assigned yet")).toBeInTheDocument();
  });

  it("navigates to /logout from the top bar action", async () => {
    const user = userEvent.setup();
    const { container } = render(<QueueBody myOrders={[]} doneOrders={[]} />);
    const logoutBtn = container.querySelector(".lucide-log-out")!.closest("button")!;
    await user.click(logoutBtn);
    expect(mockRouter.push).toHaveBeenCalledWith("/logout");
  });
});
