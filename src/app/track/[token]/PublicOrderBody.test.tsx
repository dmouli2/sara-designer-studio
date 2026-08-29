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
  advanceMethod: null,
  finalPayment: 0,
  finalPaymentMethod: null,
  due: "2026-07-10",
  lineItems: [{ particulars: "Blouse", qty: 1, amount: 1500 }],
  notes: "Handle with care",
  sketchDataUrl: "https://signed.example/sketch.png",
  referenceImageUrls: ["https://signed.example/reference.jpg"],
  materialImageUrls: ["https://signed.example/material.jpg"],
  mainMaterialImageUrl: "https://signed.example/material.jpg",
  cancellationCharge: null,
  deliveredOn: null,
  pieces: null,
  alterations: [],
  payments: [],
  createdAt: "2026-06-01",
};

describe("PublicOrderBody", () => {
  it("renders status, due date, dress/material and payment summary", () => {
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

  it("does not expose assigned staff information or measurements anywhere", () => {
    render(<PublicOrderBody order={baseOrder} />);
    expect(screen.queryByText(/master/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tailor/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Measurements")).not.toBeInTheDocument();
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

  it("shows the reference photos when present", () => {
    render(<PublicOrderBody order={baseOrder} />);
    expect(screen.getByAltText("Reference 1")).toBeInTheDocument();
  });

  it("shows a placeholder when there are no reference photos", () => {
    render(<PublicOrderBody order={{ ...baseOrder, referenceImageUrls: [] }} />);
    expect(screen.getByText("No reference photos")).toBeInTheDocument();
  });

  it("shows the material photos gallery after the dress card", () => {
    render(<PublicOrderBody order={baseOrder} />);
    expect(screen.getByAltText("Material 1")).toBeInTheDocument();

    const dress = screen.getByText(baseOrder.dress);
    const photos = screen.getByText("Material photos");
    expect(dress.compareDocumentPosition(photos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows a placeholder when there are no material photos", () => {
    render(<PublicOrderBody order={{ ...baseOrder, materialImageUrls: [] }} />);
    expect(screen.getByText("No material photos")).toBeInTheDocument();
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

  it("multiplies quantity × price for the line value and shows item comments", () => {
    render(
      <PublicOrderBody
        order={{
          ...baseOrder,
          lineItems: [{ particulars: "Lining Blouse", qty: 2, amount: 100, note: "double stitch" }],
        }}
      />
    );
    expect(screen.getByText("Lining Blouse ×2")).toBeInTheDocument();
    expect(screen.getByText("₹200")).toBeInTheDocument();
    expect(screen.getByText("(double stitch)")).toBeInTheDocument();
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

  describe("when cancelled", () => {
    it("strikes through the order total and shows the cancellation charge", () => {
      render(
        <PublicOrderBody
          order={{ ...baseOrder, status: "cancelled", amount: 4200, advance: 1000, cancellationCharge: 1600 }}
        />
      );
      expect(screen.getByText("₹4,200")).toHaveClass("line-through");
      const chargeLabel = screen.getByText("Cancellation charge");
      expect(chargeLabel.nextSibling).toHaveTextContent("₹1,600");
      expect(screen.getByText("Balance due")).toBeInTheDocument();
      expect(screen.getByText("₹600")).toBeInTheDocument();
    });

    it("shows a refund due when the advance exceeds the cancellation charge", () => {
      render(
        <PublicOrderBody
          order={{ ...baseOrder, status: "cancelled", amount: 4200, advance: 2000, cancellationCharge: 500 }}
        />
      );
      const refundLabel = screen.getByText("Refund due");
      expect(refundLabel.parentElement).toHaveTextContent("₹1,500");
    });

    it("treats a missing cancellationCharge as zero", () => {
      render(
        <PublicOrderBody order={{ ...baseOrder, status: "cancelled", advance: 0, cancellationCharge: null }} />
      );
      expect(screen.getByText("Cancellation charge").nextSibling).toHaveTextContent("₹0");
    });
  });
});
