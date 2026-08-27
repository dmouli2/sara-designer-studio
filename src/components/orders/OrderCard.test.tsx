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
  status: "cutting",
  amount: 4200,
  advance: 1000,
  // Far future so the shared fixture is never incidentally "overdue" — the
  // overdue tests below set their own past date.
  due: "2099-07-10",
  master: null,
  tailor: null,
  measurements: {
    type: "generic",
    bust: "", waist: "", hip: "", length: "", shoulder: "", sleeve: "", neckDepth: "", armRound: "",
  },
  lineItems: [],
  notes: "",
  sketchDataUrl: null,
  referenceImageUrls: [],
  materialImageUrls: [],
  mainMaterialImageUrl: null,
  cancellationCharge: null,
  createdAt: "2026-06-24",
};

describe("OrderCard", () => {
  it("renders order id, customer, dress and due date", () => {
    render(<OrderCard order={baseOrder} />);
    expect(screen.getByText(baseOrder.id)).toBeInTheDocument();
    // Customer sits on its own line, not glued to the id with a separator —
    // that pairing wrapped mid-name on a phone and pushed the id out of line.
    expect(screen.getByText(baseOrder.customer)).toBeInTheDocument();
    expect(screen.getByText(`${baseOrder.dress} · ${baseOrder.material}`)).toBeInTheDocument();
  });

  it("truncates the id, customer and material lines rather than wrapping them", () => {
    const order: Order = {
      ...baseOrder,
      customer: "Shanmuga Priya Balasubramaniam",
      material: "Kanchipuram silk with zari border (customer)",
    };
    render(<OrderCard order={order} />);
    expect(screen.getByText(order.id)).toHaveClass("truncate");
    expect(screen.getByText(order.customer)).toHaveClass("truncate");
    expect(screen.getByText(`${order.dress} · ${order.material}`)).toHaveClass("truncate");
  });

  it("keeps a two-word status label on one line next to the id", () => {
    const order: Order = { ...baseOrder, status: "cutting_done" };
    render(<OrderCard order={order} />);
    const badge = screen.getByText("Cutting Done");
    // shrink-0 + whitespace-nowrap come from the .badge-* classes in
    // globals.css; the row itself must not force the badge to wrap.
    expect(badge).toHaveClass("badge-cutting_done");
    expect(badge.parentElement).toHaveClass("justify-between");
  });

  it("shows the assigned master when present", () => {
    const order: Order = { ...baseOrder, master: { id: "m1", name: "Ramesh K." } };
    render(<OrderCard order={order} />);
    expect(screen.getByText("✂️ Ramesh K.")).toBeInTheDocument();
  });

  it("shows 'Not assigned' for master when not set", () => {
    const order: Order = { ...baseOrder, master: null };
    render(<OrderCard order={order} />);
    expect(screen.getByText("✂️ Not assigned")).toBeInTheDocument();
  });

  it("shows the assigned tailor when present", () => {
    const order: Order = { ...baseOrder, tailor: { id: "t1", name: "Anitha K." } };
    render(<OrderCard order={order} />);
    expect(screen.getByText("🧵 Anitha K.")).toBeInTheDocument();
  });

  it("shows 'Not assigned' for tailor when not set", () => {
    const order: Order = { ...baseOrder, tailor: null };
    render(<OrderCard order={order} />);
    expect(screen.getByText("🧵 Not assigned")).toBeInTheDocument();
  });

  it("highlights a new order with a gold accent border and pulsing dot", () => {
    const order: Order = { ...baseOrder, status: "new" };
    const { container } = render(<OrderCard order={order} />);
    expect(container.firstChild).toHaveClass("border-l-[#C9A84C]");
    expect(container.querySelector(".animate-ping")).toBeInTheDocument();
  });

  it("does not show the new-order highlight for other statuses", () => {
    const order: Order = { ...baseOrder, status: "cutting" };
    const { container } = render(<OrderCard order={order} />);
    expect(container.firstChild).not.toHaveClass("border-l-[#C9A84C]");
    expect(container.querySelector(".animate-ping")).not.toBeInTheDocument();
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

  it("strikes through the original amount and shows the cancellation charge for a cancelled order", () => {
    const order: Order = { ...baseOrder, status: "cancelled", amount: 4200, cancellationCharge: 500 };
    render(<OrderCard order={order} />);
    expect(screen.getByText("₹4,200")).toHaveClass("line-through");
    expect(screen.getByText("₹500")).toBeInTheDocument();
    expect(screen.queryByText(/^Bal/)).not.toBeInTheDocument();
  });

  it("treats a missing cancellationCharge as zero for a cancelled order", () => {
    const order: Order = { ...baseOrder, status: "cancelled", cancellationCharge: null };
    render(<OrderCard order={order} />);
    expect(screen.getByText("₹0")).toBeInTheDocument();
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

  it("highlights an active order whose due date has passed as overdue", () => {
    const order: Order = { ...baseOrder, due: "2020-01-01" };
    const { container } = render(<OrderCard order={order} />);
    expect(screen.getByText(/Overdue · was due/)).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("border-l-[#B04A4A]");
  });

  it("does not mark a delivered order as overdue even when past its due date", () => {
    const order: Order = { ...baseOrder, due: "2020-01-01", status: "delivered" };
    render(<OrderCard order={order} />);
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
    expect(screen.getByText(/^Due /)).toBeInTheDocument();
  });

  it("shows the main material photo as a fixed square thumbnail", () => {
    const order: Order = { ...baseOrder, mainMaterialImageUrl: "https://signed.example/material-1.jpg" };
    render(<OrderCard order={order} />);
    const img = screen.getByAltText("Material");
    expect(img).toHaveAttribute("src", "https://signed.example/material-1.jpg");
    // A fixed square, not self-stretch: stretching let the photo grow to the
    // full card height and swallow the layout on a phone.
    expect(img.parentElement).toHaveClass("w-16", "h-16", "shrink-0");
    expect(img.parentElement).not.toHaveClass("self-stretch");
  });

  it("shows no thumbnail when there is no main material photo", () => {
    render(<OrderCard order={baseOrder} />);
    expect(screen.queryByAltText("Material")).not.toBeInTheDocument();
  });
});
