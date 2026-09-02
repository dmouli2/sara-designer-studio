import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CollapsibleMeasurements from "./CollapsibleMeasurements";
import { emptyBlouse, emptySalwar } from "@/lib/measurements";

describe("CollapsibleMeasurements", () => {
  it("starts folded away, with the form still in the page", () => {
    render(<CollapsibleMeasurements dress="Blouse" value={emptyBlouse()} onChange={vi.fn()} />);
    expect(screen.getByText("Add measurements (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Length")).not.toBeVisible();
  });

  it("opens on a tap and folds shut again", async () => {
    const user = userEvent.setup();
    render(<CollapsibleMeasurements dress="Blouse" value={emptyBlouse()} onChange={vi.fn()} />);

    await user.click(screen.getByText("Add measurements (optional)"));
    expect(screen.getByLabelText("Length")).toBeVisible();

    await user.click(screen.getByText("Add measurements (optional)"));
    expect(screen.getByLabelText("Length")).not.toBeVisible();
  });

  // An order that already carries figures must never open with them hidden —
  // that is how an edit quietly drops a measurement somebody entered.
  it("opens unfolded when asked to", () => {
    render(
      <CollapsibleMeasurements dress="Blouse" value={emptyBlouse()} onChange={vi.fn()} defaultOpen />
    );
    expect(screen.getByLabelText("Length")).toBeVisible();
  });

  it("stays open while the last figure is cleared", async () => {
    const user = userEvent.setup();
    // Open-ness is its own state, not derived from the value — otherwise
    // clearing the only measurement would fold the panel shut mid-edit.
    render(
      <CollapsibleMeasurements
        dress="Blouse"
        value={{ ...emptyBlouse(), length: "15" }}
        onChange={vi.fn()}
        defaultOpen
      />
    );

    await user.clear(screen.getByLabelText("Length"));
    expect(screen.getByLabelText("Length")).toBeVisible();
  });

  it("reports edits to its owner", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CollapsibleMeasurements
        dress="Blouse"
        value={emptyBlouse()}
        onChange={onChange}
        defaultOpen
      />
    );

    await user.type(screen.getByLabelText("Length"), "6");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ length: "6" }));
  });

  it("renders the salwar form for a salwar order", () => {
    render(
      <CollapsibleMeasurements dress="Salwar" value={emptySalwar()} onChange={vi.fn()} defaultOpen />
    );
    expect(screen.getByText("M. Top")).toBeInTheDocument();
    expect(screen.getByText("M. Pant")).toBeInTheDocument();
  });
});
