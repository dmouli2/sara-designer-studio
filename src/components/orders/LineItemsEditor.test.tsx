import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LineItemsEditor from "./LineItemsEditor";
import type { OrderLineItem } from "@/types";

const presets: OrderLineItem[] = [
  { particulars: "Blouse", qty: 1, amount: 400 },
  { particulars: "Lining Blouse", qty: 0, amount: 0 },
];

function setup(items: OrderLineItem[] = presets, presetCount = 2) {
  const onChange = vi.fn();
  render(<LineItemsEditor items={items} presetCount={presetCount} onChange={onChange} />);
  return { onChange };
}

describe("LineItemsEditor", () => {
  it("renders preset rows with a fixed label and no remove button", () => {
    setup();
    expect(screen.getByText("Blouse")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("totals every row as qty × price", () => {
    setup([
      { particulars: "Blouse", qty: 3, amount: 400 },
      { particulars: "Designs", qty: 2, amount: 150 },
    ]);
    expect(screen.getByText("₹1,500")).toBeInTheDocument();
  });

  it("edits a preset row's quantity, price and comment", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.type(screen.getByLabelText("Blouse quantity"), "2");
    expect(onChange).toHaveBeenLastCalledWith([{ ...presets[0], qty: 12 }, presets[1]]);

    await user.type(screen.getByLabelText("Blouse price"), "5");
    expect(onChange).toHaveBeenLastCalledWith([{ ...presets[0], amount: 4005 }, presets[1]]);

    await user.type(screen.getByLabelText("Blouse comments"), "x");
    expect(onChange).toHaveBeenLastCalledWith([{ ...presets[0], note: "x" }, presets[1]]);
  });

  it("treats a cleared number field as zero rather than NaN", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.clear(screen.getByLabelText("Blouse quantity"));
    expect(onChange).toHaveBeenLastCalledWith([{ ...presets[0], qty: 0 }, presets[1]]);
  });

  // The point of the feature: anything the shop does that isn't a printed row.
  it("appends an empty row with quantity one", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByRole("button", { name: "Add item" }));
    expect(onChange).toHaveBeenCalledWith([...presets, { particulars: "", qty: 1, amount: 0 }]);
  });

  it("lets an added row be named and removed", async () => {
    const user = userEvent.setup();
    const items = [...presets, { particulars: "Kids frock", qty: 1, amount: 900 }];
    const { onChange } = setup(items, 2);

    await user.type(screen.getByLabelText("Item 3 name"), "!");
    expect(onChange).toHaveBeenLastCalledWith([
      ...presets,
      { particulars: "Kids frock!", qty: 1, amount: 900 },
    ]);

    await user.click(screen.getByRole("button", { name: "Remove Kids frock" }));
    expect(onChange).toHaveBeenLastCalledWith(presets);
  });

  // A row that hasn't been named yet still needs stable accessible labels.
  it("falls back to the row position while an added row is nameless", () => {
    setup([...presets, { particulars: "", qty: 1, amount: 0 }], 2);
    expect(screen.getByLabelText("Item 3 quantity")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Item 3" })).toBeInTheDocument();
  });

  // A scan appends unrecognised handwritten rows past the presets — those
  // become editable here, which is how a mis-read row name gets fixed.
  it("treats scan-appended rows as removable custom rows", () => {
    setup([...presets, { particulars: "hand embroidery neck", qty: 1, amount: 250 }], 2);
    expect(screen.getByRole("button", { name: "Remove hand embroidery neck" })).toBeInTheDocument();
  });
});
