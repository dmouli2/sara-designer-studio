import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PublicOrderBody from "./PublicOrderBody";
import type { PublicOrder } from "@/lib/db";

const baseOrder: PublicOrder = {
  id: "SDS-001",
  customer: "Priya",
  phone: "999",
  dress: "Blouse",
  material: "Silk (shop)",
  status: "cutting",
  amount: 4200,
  advance: 1000,
  due: "2026-07-10",
  measurements: { type: "generic", bust: "34", waist: "28", hip: "36", length: "40", shoulder: "14", sleeve: "20", neckDepth: "6", armRound: "15" },
  lineItems: [{ particulars: "Blouse", qty: 1, amount: 1500 }],
  notes: "Handle with care",
  sketchDataUrl: "https://signed.example/sketch.png",
  referenceImageUrl: "https://signed.example/reference.jpg",
  createdAt: "2026-06-01",
};

describe("PublicOrderBody", () => {
  it("renders status, due date, dress/material, measurements and payment summary", () => {
    const { container } = render(<PublicOrderBody order={baseOrder} />);

    expect(screen.getByText("Order SDS-001")).toBeInTheDocument();
    expect(container.querySelector(".badge-cutting")).toHaveTextContent("Cutting");
    expect(screen.getByText("Due 10 Jul 2026")).toBeInTheDocument();
    expect(screen.getByText("Blouse")).toBeInTheDocument();
    expect(screen.getByText("Silk (shop)")).toBeInTheDocument();
    expect(screen.getByText("₹4,200")).toBeInTheDocument();
    expect(screen.getByText("₹1,000")).toBeInTheDocument();
    expect(screen.getByText("₹3,200")).toBeInTheDocument();
  });

  it("does not expose assigned staff information anywhere", () => {
    render(<PublicOrderBody order={baseOrder} />);
    expect(screen.queryByText(/master/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tailor/i)).not.toBeInTheDocument();
  });

  it("shows notes when present", () => {
    render(<PublicOrderBody order={baseOrder} />);
    expect(screen.getByText('"Handle with care"')).toBeInTheDocument();
  });

  it("omits the notes block when there are no notes", () => {
    render(<PublicOrderBody order={{ ...baseOrder, notes: "" }} />);
    expect(screen.queryByText(/"/)).not.toBeInTheDocument();
  });

  it("shows the sketch image when present", () => {
    render(<PublicOrderBody order={baseOrder} />);
    expect(screen.getByAltText("Sketch")).toBeInTheDocument();
  });

  it("omits the sketch section when no sketch is stored", () => {
    render(<PublicOrderBody order={{ ...baseOrder, sketchDataUrl: null }} />);
    expect(screen.queryByAltText("Sketch")).not.toBeInTheDocument();
  });

  it("shows the reference photo when present", () => {
    render(<PublicOrderBody order={baseOrder} />);
    expect(screen.getByAltText("Reference")).toBeInTheDocument();
  });

  it("omits the reference photo section when none is stored", () => {
    render(<PublicOrderBody order={{ ...baseOrder, referenceImageUrl: null }} />);
    expect(screen.queryByAltText("Reference")).not.toBeInTheDocument();
  });

  it("lists line items with quantity and amount when present", () => {
    render(<PublicOrderBody order={baseOrder} />);
    expect(screen.getByText("Blouse ×1")).toBeInTheDocument();
    expect(screen.getByText("₹1,500")).toBeInTheDocument();
  });

  it("separates subsequent line items with a divider", () => {
    const { container } = render(
      <PublicOrderBody
        order={{
          ...baseOrder,
          lineItems: [
            { particulars: "Blouse", qty: 1, amount: 1500 },
            { particulars: "Lining Blouse", qty: 1, amount: 500 },
          ],
        }}
      />
    );
    expect(screen.getByText("Lining Blouse ×1")).toBeInTheDocument();
    expect(container.querySelectorAll(".border-t.border-\\[\\#F0EDE6\\]")).toHaveLength(1);
  });

  it("omits the order-items section when there are no line items", () => {
    render(<PublicOrderBody order={{ ...baseOrder, lineItems: [] }} />);
    expect(screen.queryByText("Order items")).not.toBeInTheDocument();
  });

  it("floors the balance due at zero when the order is fully paid", () => {
    render(<PublicOrderBody order={{ ...baseOrder, amount: 1000, advance: 1000 }} />);
    const balanceLabel = screen.getByText("Balance due");
    expect(balanceLabel.parentElement).toHaveTextContent("₹0");
  });
});
