import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MeasurementFieldRow from "./MeasurementFieldRow";

function renderRow(overrides: Partial<React.ComponentProps<typeof MeasurementFieldRow>> = {}) {
  const props = {
    label: "Bust",
    value: "34",
    note: "",
    striped: false,
    bordered: false,
    onValueChange: vi.fn(),
    onNoteChange: vi.fn(),
    ...overrides,
  };
  render(<MeasurementFieldRow {...props} />);
  return props;
}

describe("MeasurementFieldRow", () => {
  it("shows the label with the value input beside it and a note input", () => {
    renderRow({ note: "loose fit" });
    expect(screen.getByText("Bust")).toBeInTheDocument();
    expect(screen.getByLabelText("Bust")).toHaveValue(34);
    expect(screen.getByLabelText("Bust note")).toHaveValue("loose fit");
  });

  it("propagates value edits", async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderRow({ value: "" });
    await user.type(screen.getByLabelText("Bust"), "3");
    expect(onValueChange).toHaveBeenCalledWith("3");
  });

  it("propagates note edits", async () => {
    const user = userEvent.setup();
    const { onNoteChange } = renderRow();
    await user.type(screen.getByLabelText("Bust note"), "x");
    expect(onNoteChange).toHaveBeenCalledWith("x");
  });

  it("applies zebra striping and the divider border when asked", () => {
    renderRow({ striped: true, bordered: true });
    const row = screen.getByText("Bust").parentElement!;
    expect(row.className).toContain("bg-surface-3");
    expect(row.className).toContain("border-t");
  });

  it("uses a plain background and no divider on the first row", () => {
    renderRow({ striped: false, bordered: false });
    const row = screen.getByText("Bust").parentElement!;
    expect(row.className).toContain("bg-surface");
    expect(row.className).not.toContain("border-t");
  });
});
