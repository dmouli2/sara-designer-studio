import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportDateRangeFilter from "./ReportDateRangeFilter";
import { DEFAULT_REPORT_DATE_RANGE } from "@/lib/reports";

describe("ReportDateRangeFilter", () => {
  it("highlights the active preset and does not show custom date inputs", () => {
    render(<ReportDateRangeFilter value={DEFAULT_REPORT_DATE_RANGE} onChange={vi.fn()} />);
    expect(screen.getByText("This Month")).toHaveClass("bg-[#0F0F0F]");
    expect(screen.queryByLabelText("Custom range from")).not.toBeInTheDocument();
  });

  it("reports a preset change when a chip is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ReportDateRangeFilter value={DEFAULT_REPORT_DATE_RANGE} onChange={onChange} />);
    await user.click(screen.getByText("Last 3 Months"));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_REPORT_DATE_RANGE, preset: "last_3_months" });
  });

  it("shows custom date inputs when the Custom preset is selected", () => {
    render(
      <ReportDateRangeFilter
        value={{ preset: "custom", customFrom: "", customTo: "" }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Custom range from")).toBeInTheDocument();
    expect(screen.getByLabelText("Custom range to")).toBeInTheDocument();
  });

  // Two date boxes side by side is the narrowest spot in the app. A flex item
  // defaults to min-width:auto, so without an explicit shrink each box held
  // its intrinsic width and the second one ran off the right edge of a phone
  // (measured: right edge at 328px in a 320px viewport).
  it("lets each half of the custom range shrink inside the row", () => {
    render(
      <ReportDateRangeFilter
        value={{ preset: "custom", customFrom: "", customTo: "" }}
        onChange={vi.fn()}
      />
    );

    for (const label of ["Custom range from", "Custom range to"]) {
      const wrapper = screen.getByLabelText(label).closest("label");
      expect(wrapper).toHaveClass("flex-1");
      expect(wrapper).toHaveClass("min-w-0");
    }
  });

  it("labels each half of the custom range", () => {
    render(
      <ReportDateRangeFilter
        value={{ preset: "custom", customFrom: "", customTo: "" }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("To")).toBeInTheDocument();
  });

  it("reports custom from/to changes", () => {
    const onChange = vi.fn();
    const value = { preset: "custom" as const, customFrom: "", customTo: "" };
    render(<ReportDateRangeFilter value={value} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Custom range from"), { target: { value: "2026-01-01" } });
    expect(onChange).toHaveBeenCalledWith({ ...value, customFrom: "2026-01-01" });

    fireEvent.change(screen.getByLabelText("Custom range to"), { target: { value: "2026-02-01" } });
    expect(onChange).toHaveBeenCalledWith({ ...value, customTo: "2026-02-01" });
  });
});
