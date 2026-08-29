import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PiecesEditor from "./PiecesEditor";
import { MAX_ORDER_PIECES, type MaterialSource } from "@/types";

type Extra = {
  minCount?: number;
  minCountReason?: string;
  uniform?: boolean;
  sources?: MaterialSource[];
  orderSource?: MaterialSource;
};

function setup(count = 1, extra: Extra = {}) {
  const onChange = vi.fn();
  const onUniformChange = vi.fn();
  const onSourceChange = vi.fn();
  const { uniform = true, sources = [], orderSource = "customer", ...rest } = extra;
  render(
    <PiecesEditor
      count={count}
      labelPrefix="Blouse"
      onChange={onChange}
      uniform={uniform}
      onUniformChange={onUniformChange}
      sources={sources}
      onSourceChange={onSourceChange}
      orderSource={orderSource}
      {...rest}
    />
  );
  return { onChange, onUniformChange, onSourceChange };
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
  // which is set once in the pricing step.
  it("says the garments share the order's delivery date", () => {
    setup(3);
    expect(screen.getByText(/Blouse 1–3 share this order's delivery date/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/delivery date/i)).not.toBeInTheDocument();
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
      setup(2, { minCount: 2 });
      expect(screen.getByRole("button", { name: "One less piece" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "One more piece" })).not.toBeDisabled();
    });

    it("explains why, but only at the floor", async () => {
      const user = userEvent.setup();
      const { onChange } = setup(2, { minCount: 2, minCountReason: "1 already handed over" });
      expect(screen.getByText("1 already handed over")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "One more piece" }));
      expect(onChange).toHaveBeenCalledWith(3);
    });

    it("hides the explanation above the floor", () => {
      setup(4, { minCount: 2, minCountReason: "1 already handed over" });
      expect(screen.queryByText("1 already handed over")).not.toBeInTheDocument();
    });

    it("never shows a count below the floor", () => {
      setup(1, { minCount: 3 });
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  // A mixed order is the rare one, so per-garment rows stay hidden until the
  // admin says the garments differ.
  describe("per-garment material source", () => {
    it("says nothing about material for a single garment", () => {
      setup(1);
      expect(screen.queryByText(/same material/)).not.toBeInTheDocument();
    });

    it("offers one checkbox, ticked, once split", () => {
      setup(3, { orderSource: "customer" });
      const box = screen.getByRole("checkbox");
      expect(box).toBeChecked();
      expect(screen.getByText(/All 3 use the same material \(customer brings\)/)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Blouse 1 material/)).not.toBeInTheDocument();
    });

    it("reveals a row per garment when unticked", async () => {
      const user = userEvent.setup();
      const { onUniformChange } = setup(3);
      await user.click(screen.getByRole("checkbox"));
      expect(onUniformChange).toHaveBeenCalledWith(false);
    });

    it("shows each garment's source and reports a change", async () => {
      const user = userEvent.setup();
      const { onSourceChange } = setup(2, {
        uniform: false,
        sources: ["customer", "shop"],
      });
      expect(screen.getByLabelText("Blouse 2 material shop")).toHaveAttribute("aria-pressed", "true");
      await user.click(screen.getByLabelText("Blouse 1 material shop"));
      expect(onSourceChange).toHaveBeenCalledWith(0, "shop");
    });

    // A gap in the array means "not overridden yet", so it shows the order's
    // own source rather than a blank.
    it("falls back to the order's source for an unset garment", () => {
      setup(2, { uniform: false, sources: [], orderSource: "shop" });
      expect(screen.getByLabelText("Blouse 1 material shop")).toHaveAttribute("aria-pressed", "true");
    });
  });
});
