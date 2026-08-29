import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrderPiecesCard from "./OrderPiecesCard";
import type { Order, OrderPiece, OrderStatus } from "@/types";

function piece(over: Partial<OrderPiece> = {}): OrderPiece {
  return { id: "p1", label: "Blouse 1", due: "2026-09-10", status: "pending", deliveredAt: null, ...over };
}

function order(pieces: OrderPiece[], status: OrderStatus = "ready"): Pick<Order, "pieces" | "status"> {
  return { pieces, status };
}

afterEach(() => vi.useRealTimers());

describe("OrderPiecesCard", () => {
  // The count is the screen's whole reason for existing — it answers "how
  // many are delivered" without making anyone tally the rows.
  it("states the delivered count up front", () => {
    render(
      <OrderPiecesCard
        order={order([
          piece({ status: "delivered", deliveredAt: "2026-09-02T00:00:00Z" }),
          piece({ id: "p2", label: "Blouse 2" }),
          piece({ id: "p3", label: "Blouse 3" }),
        ])}
      />
    );
    expect(screen.getByText("1 of 3 delivered")).toBeInTheDocument();
  });

  it("shows the hand-over date for a delivered garment and no button", () => {
    render(
      <OrderPiecesCard
        order={order([piece({ status: "delivered", deliveredAt: "2026-09-02T00:00:00Z" })])}
        onDeliver={vi.fn()}
      />
    );
    // JSX splits "Handed over" and the date into separate text nodes, and
    // en-IN renders September as "Sept".
    expect(
      screen.getByText(
        (_, el) => el?.tagName === "SPAN" && el.textContent === "Handed over 2 Sept 2026"
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hand over" })).not.toBeInTheDocument();
  });

  // Read-only views (the role queues, the customer's tracking page) pass no
  // callbacks and get no controls.
  it("renders read-only when no callbacks are given", () => {
    render(<OrderPiecesCard order={order([piece(), piece({ id: "p2", label: "Blouse 2" })])} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Blouse 1")).toBeInTheDocument();
  });

  it("hands a pending garment over", async () => {
    const user = userEvent.setup();
    const onDeliver = vi.fn();
    render(<OrderPiecesCard order={order([piece()])} onDeliver={onDeliver} />);
    await user.click(screen.getByRole("button", { name: "Hand over" }));
    expect(onDeliver).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }));
  });

  it("shows a saving state on the piece being handed over", () => {
    render(<OrderPiecesCard order={order([piece()])} onDeliver={vi.fn()} busyPieceId="p1" />);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("offers no hand-over on a cancelled order", () => {
    render(<OrderPiecesCard order={order([piece()], "cancelled")} onDeliver={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Hand over" })).not.toBeInTheDocument();
  });

  it("flags a piece whose own date has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T10:00:00"));
    render(<OrderPiecesCard order={order([piece({ due: "2026-09-10" })])} />);
    expect(screen.getByText(/Overdue · was due/)).toBeInTheDocument();
  });

  it("edits a pending piece's date and closes the editor", async () => {
    const user = userEvent.setup();
    const onChangeDue = vi.fn();
    render(<OrderPiecesCard order={order([piece()])} onChangeDue={onChangeDue} />);

    await user.click(screen.getByRole("button", { name: "Change Blouse 1 delivery date" }));
    const input = screen.getByLabelText("Blouse 1 delivery date");
    fireEvent.change(input, { target: { value: "2026-09-20" } });

    expect(onChangeDue).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }), "2026-09-20");
    expect(screen.queryByLabelText("Blouse 1 delivery date")).not.toBeInTheDocument();
  });

  it("ignores a cleared date rather than saving an empty one", async () => {
    const user = userEvent.setup();
    const onChangeDue = vi.fn();
    render(<OrderPiecesCard order={order([piece()])} onChangeDue={onChangeDue} />);
    await user.click(screen.getByRole("button", { name: "Change Blouse 1 delivery date" }));
    fireEvent.change(screen.getByLabelText("Blouse 1 delivery date"), { target: { value: "" } });
    expect(onChangeDue).not.toHaveBeenCalled();
  });

  it("closes the date editor on blur without saving", async () => {
    const user = userEvent.setup();
    const onChangeDue = vi.fn();
    render(<OrderPiecesCard order={order([piece()])} onChangeDue={onChangeDue} />);
    await user.click(screen.getByRole("button", { name: "Change Blouse 1 delivery date" }));
    fireEvent.blur(screen.getByLabelText("Blouse 1 delivery date"));
    expect(screen.queryByLabelText("Blouse 1 delivery date")).not.toBeInTheDocument();
    expect(onChangeDue).not.toHaveBeenCalled();
  });

  it("survives a null pieces list", () => {
    render(<OrderPiecesCard order={{ pieces: null, status: "ready" }} />);
    expect(screen.getByText("0 of 0 delivered")).toBeInTheDocument();
  });

  // The chip only earns its place when the garments actually differ — on a
  // uniform order the order's material line already says it.
  describe("mixed material", () => {
    it("marks each garment when they come from different places", () => {
      render(
        <OrderPiecesCard
          order={order([
            piece({ id: "p1", label: "Blouse 1", materialSource: "shop" }),
            piece({ id: "p2", label: "Blouse 2", materialSource: "customer" }),
          ])}
        />
      );
      expect(screen.getByText("Shop")).toBeInTheDocument();
      expect(screen.getByText("Customer")).toBeInTheDocument();
    });

    it("says nothing when every garment matches", () => {
      render(
        <OrderPiecesCard
          order={order([
            piece({ id: "p1", label: "Blouse 1", materialSource: "shop" }),
            piece({ id: "p2", label: "Blouse 2", materialSource: "shop" }),
          ])}
        />
      );
      expect(screen.queryByText("Shop")).not.toBeInTheDocument();
    });

    it("says nothing for pieces stored before sources were recorded", () => {
      render(<OrderPiecesCard order={order([piece({ id: "p1" }), piece({ id: "p2" })])} />);
      expect(screen.queryByText("Shop")).not.toBeInTheDocument();
      expect(screen.queryByText("Customer")).not.toBeInTheDocument();
    });
  });
});
