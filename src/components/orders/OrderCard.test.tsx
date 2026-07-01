import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrderCard from "./OrderCard";
import type { Order } from "@/types";

const baseOrder: Order = {
  id: "SDS-007",
  customer: "Priya Sharma",
  phone: "9876543210",
  dress: "Blouse",
  material: "Silk (shop)",
  status: "new",
  amount: 4200,
  advance: 1000,
  due: "2026-07-10",
  master: null,
  tailor: null,
  measurements: {
    type: "generic",
    bust: "", waist: "", hip: "", length: "", shoulder: "", sleeve: "", neckDepth: "", armRound: "",
  },
  lineItems: [],
  notes: "",
  sketchDataUrl: null,
  referenceImageUrl: null,
  createdAt: "2026-06-24",
};

describe("OrderCard", () => {
  it("renders order id, customer, dress and due date", () => {
    render(<OrderCard order={baseOrder} />);
    expect(screen.getByText(baseOrder.id)).toBeInTheDocument();
    expect(screen.getByText(`· ${baseOrder.customer}`)).toBeInTheDocument();
    expect(screen.getByText(`${baseOrder.dress} · ${baseOrder.material}`)).toBeInTheDocument();
  });

  it("shows the assigned master when present", () => {
    const order: Order = { ...baseOrder, master: { id: "m1", name: "Ramesh K." } };
    render(<OrderCard order={order} />);
    expect(screen.getByText("Ramesh K.")).toBeInTheDocument();
  });

  it("hides master info when not assigned", () => {
    const order: Order = { ...baseOrder, master: null };
    render(<OrderCard order={order} />);
    expect(screen.queryByText("Ramesh K.")).not.toBeInTheDocument();
  });

  it("shows price and balance by default when there is a balance due", () => {
    const order: Order = { ...baseOrder, amount: 4200, advance: 1000 };
    render(<OrderCard order={order} />);
    expect(screen.getByText("₹4,200")).toBeInTheDocument();
    expect(screen.getByText("Bal ₹3,200")).toBeInTheDocument();
  });

  it("hides the balance line when fully paid", () => {
    const order: Order = { ...baseOrder, amount: 1800, advance: 1800 };
    render(<OrderCard order={order} />);
    expect(screen.getByText("₹1,800")).toBeInTheDocument();
    expect(screen.queryByText(/^Bal/)).not.toBeInTheDocument();
  });

  it("hides price entirely when showPrice is false", () => {
    render(<OrderCard order={baseOrder} showPrice={false} />);
    expect(screen.queryByText(/^₹/)).not.toBeInTheDocument();
  });

  it("applies a custom className alongside the base classes", () => {
    const { container } = render(<OrderCard order={baseOrder} className="opacity-70" />);
    expect(container.firstChild).toHaveClass("opacity-70");
    expect(container.firstChild).toHaveClass("card");
  });

  it("invokes onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { container } = render(<OrderCard order={baseOrder} onClick={onClick} />);
    await user.click(container.firstChild as Element);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
