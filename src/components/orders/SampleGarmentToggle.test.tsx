import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SampleGarmentToggle from "./SampleGarmentToggle";

describe("SampleGarmentToggle", () => {
  it("asks about the garment the book is for", () => {
    const { rerender } = render(
      <SampleGarmentToggle dress="Blouse" checked={false} onChange={vi.fn()} />
    );
    expect(screen.getByLabelText(/customer gave a measurement blouse/i)).not.toBeChecked();

    rerender(<SampleGarmentToggle dress="Salwar" checked={false} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/customer gave a measurement salwar/i)).toBeInTheDocument();
  });

  it("explains the consequence once it is ticked", () => {
    const { rerender } = render(
      <SampleGarmentToggle dress="Blouse" checked={false} onChange={vi.fn()} />
    );
    expect(screen.getByText(/tick if they left one of their own/i)).toBeInTheDocument();

    rerender(<SampleGarmentToggle dress="Blouse" checked onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByText(/no measurements needed/i)).toBeInTheDocument();
    expect(screen.getByText(/return it with the order/i)).toBeInTheDocument();
  });

  it("reports both directions to its owner", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <SampleGarmentToggle dress="Blouse" checked={false} onChange={onChange} />
    );

    await user.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith(true);

    rerender(<SampleGarmentToggle dress="Blouse" checked onChange={onChange} />);
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});
