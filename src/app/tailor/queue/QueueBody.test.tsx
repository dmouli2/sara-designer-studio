import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QueueBody from "./QueueBody";
import { mockRouter } from "../../../../vitest.setup";
import type { Order } from "@/types";

function order(overrides: Partial<Order>): Order {
  return {
    id: "B1",
    customer: "Priya",
    phone: "999",
    dress: "Blouse",
    material: "Silk",
    status: "stitching",
    amount: 1000,
    advance: 0,
    due: "2026-07-10",
    master: null,
    tailor: { id: "t1", name: "Anitha K." },
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
  it("shows an empty state when there are no assigned jobs", () => {
    render(<QueueBody myOrders={[]} readyOrders={[]} />);
    expect(screen.getByText("No jobs assigned yet")).toBeInTheDocument();
  });

  it("shows only in-progress orders on the Queue tab, not ready ones", async () => {
    const user = userEvent.setup();
    render(
      <QueueBody
        myOrders={[order({ id: "B1", status: "stitching" })]}
        readyOrders={[order({ id: "B2", status: "ready" })]}
      />
    );

    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("B1")).toBeInTheDocument();
    expect(screen.queryByText("B2")).not.toBeInTheDocument();

    await user.click(screen.getByText("B1").closest(".card")!);
    expect(mockRouter.push).toHaveBeenCalledWith("/tailor/orders/B1");
  });

  it("moves an order to the Done tab once marked ready, out of the Queue tab", async () => {
    const user = userEvent.setup();
    render(
      <QueueBody
        myOrders={[order({ id: "B1", status: "stitching" })]}
        readyOrders={[order({ id: "B2", status: "ready" })]}
      />
    );

    expect(screen.queryByText("B2")).not.toBeInTheDocument();

    await user.click(screen.getByText("Done"));
    expect(screen.getByText("Ready for pickup")).toBeInTheDocument();
    expect(screen.getByText("B2")).toBeInTheDocument();
    expect(screen.queryByText("B1")).not.toBeInTheDocument();

    await user.click(screen.getByText("B2").closest(".card")!);
    expect(mockRouter.push).toHaveBeenCalledWith("/tailor/orders/B2");
  });

  it("shows an empty state on the Done tab when nothing is ready yet", async () => {
    const user = userEvent.setup();
    render(<QueueBody myOrders={[order({ id: "B1" })]} readyOrders={[]} />);
    await user.click(screen.getByText("Done"));
    expect(screen.getByText("No completed jobs yet")).toBeInTheDocument();
  });

  it("navigates to /logout from the top bar action", async () => {
    const user = userEvent.setup();
    const { container } = render(<QueueBody myOrders={[]} readyOrders={[]} />);
    const logoutBtn = container.querySelector(".lucide-log-out")!.closest("button")!;
    await user.click(logoutBtn);
    expect(mockRouter.push).toHaveBeenCalledWith("/logout");
  });
});
