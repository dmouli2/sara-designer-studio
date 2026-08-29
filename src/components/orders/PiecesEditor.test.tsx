import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PiecesEditor from "./PiecesEditor";
import { MAX_ORDER_PIECES } from "@/types";

function setup(count = 1, orderDue = "2026-09-01", extra: { minCount?: number; minCountReason?: string } = {}) {
  const onChange = vi.fn();
  render(
    <PiecesEditor
      count={count}
      orderDue={orderDue}
      labelPrefix="Blouse"
      onChange={onChange}
      {...extra}
    />
  );
  return { onChange };
}

describe("PiecesEditor", () => {
  // One garment is the default and almost every order — it must cost nothing
  // to walk past.
  it("starts at one and says nothing more", () => {
    setup();
    expect(screen.getByText("How many blouses?")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText(/One garment/)).toBeInTheDocument();
    expect(screen.queryByText(/all due/)).not.toBeInTheDocument();
  });

  it("cannot go below one", () => {
    setup();
    expect(screen.getByRole("button", { name: "One less piece" })).toBeDisabled();
  });

  it("counts up and down", async () => {
    const user = userEvent.setup();
    const { onChange } = setup(2);
    await user.click(screen.getByRole("button", { name: "One more piece" }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await user.click(screen.getByRole("button", { name: "One less piece" }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("stops at the maximum", () => {
    setup(MAX_ORDER_PIECES);
    expect(screen.getByRole("button", { name: "One more piece" })).toBeDisabled();
  });

  // No per-garment date rows: everything shares the order's delivery date,
  // which is stated back rather than asked for again.
  it("confirms the shared delivery date once split", () => {
    setup(3, "2026-09-01");
    expect(screen.getByText(/Blouse 1–3, all due 1 Sept 2026/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/delivery date/i)).not.toBeInTheDocument();
  });

  it("copes with the delivery date not being set yet", () => {
    setup(2, "");
    expect(screen.getByText(/all due on the delivery date/)).toBeInTheDocument();
  });

  it("treats a nonsense count as one", () => {
    setup(0);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  // On the edit screen the floor sits one above whatever is already with the
  // customer — those garments can't be removed, and the last one still here
  // has to leave through a hand-over.
  describe("with a floor", () => {
    it("won't step below it", () => {
      setup(2, "2026-09-01", { minCount: 2 });
      expect(screen.getByRole("button", { name: "One less piece" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "One more piece" })).not.toBeDisabled();
    });

    it("explains why, but only at the floor", async () => {
      const user = userEvent.setup();
      const { onChange } = setup(2, "2026-09-01", { minCount: 2, minCountReason: "1 already handed over" });
      expect(screen.getByText("1 already handed over")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "One more piece" }));
      expect(onChange).toHaveBeenCalledWith(3);
    });

    it("hides the explanation above the floor", () => {
      setup(4, "2026-09-01", { minCount: 2, minCountReason: "1 already handed over" });
      expect(screen.queryByText("1 already handed over")).not.toBeInTheDocument();
    });

    it("never shows a count below the floor", () => {
      setup(1, "2026-09-01", { minCount: 3 });
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });
});
