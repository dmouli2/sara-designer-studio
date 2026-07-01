import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrderFiltersSheet, { EMPTY_ORDER_FILTERS, hasActiveFilters } from "./OrderFiltersSheet";
import type { AssignedStaff } from "@/types";

const MASTERS: AssignedStaff[] = [{ id: "m1", name: "Ramesh K." }];
const TAILORS: AssignedStaff[] = [{ id: "t1", name: "Anitha K." }];

describe("hasActiveFilters", () => {
  it("is false for the empty filter set", () => {
    expect(hasActiveFilters(EMPTY_ORDER_FILTERS)).toBe(false);
  });

  it("is true when any field is set", () => {
    expect(hasActiveFilters({ ...EMPTY_ORDER_FILTERS, masterId: "m1" })).toBe(true);
  });
});

describe("OrderFiltersSheet", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <OrderFiltersSheet
        open={false}
        values={EMPTY_ORDER_FILTERS}
        masters={MASTERS}
        tailors={TAILORS}
        onChange={vi.fn()}
        onClear={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists the provided masters and tailors", () => {
    render(
      <OrderFiltersSheet
        open
        values={EMPTY_ORDER_FILTERS}
        masters={MASTERS}
        tailors={TAILORS}
        onChange={vi.fn()}
        onClear={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Ramesh K.")).toBeInTheDocument();
    expect(screen.getByText("Anitha K.")).toBeInTheDocument();
  });

  it("reports a merged value when the master select changes", () => {
    const onChange = vi.fn();
    render(
      <OrderFiltersSheet
        open
        values={EMPTY_ORDER_FILTERS}
        masters={MASTERS}
        tailors={TAILORS}
        onChange={onChange}
        onClear={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.change(screen.getByDisplayValue("All masters"), { target: { value: "m1" } });
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_ORDER_FILTERS, masterId: "m1" });
  });

  it("reports a merged value when a date input changes", () => {
    const onChange = vi.fn();
    render(
      <OrderFiltersSheet
        open
        values={EMPTY_ORDER_FILTERS}
        masters={MASTERS}
        tailors={TAILORS}
        onChange={onChange}
        onClear={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText("Due date from"), { target: { value: "2026-07-01" } });
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_ORDER_FILTERS, dueFrom: "2026-07-01" });
  });

  it("reports merged values for the remaining date fields (due-to, created-from, created-to)", () => {
    const onChange = vi.fn();
    render(
      <OrderFiltersSheet
        open
        values={EMPTY_ORDER_FILTERS}
        masters={MASTERS}
        tailors={TAILORS}
        onChange={onChange}
        onClear={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText("Due date to"), { target: { value: "2026-07-31" } });
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_ORDER_FILTERS, dueTo: "2026-07-31" });

    fireEvent.change(screen.getByLabelText("Created date from"), { target: { value: "2026-06-01" } });
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_ORDER_FILTERS, createdFrom: "2026-06-01" });

    fireEvent.change(screen.getByLabelText("Created date to"), { target: { value: "2026-06-30" } });
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_ORDER_FILTERS, createdTo: "2026-06-30" });
  });

  it("calls onClear and onClose from their respective buttons", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const onClose = vi.fn();
    render(
      <OrderFiltersSheet
        open
        values={EMPTY_ORDER_FILTERS}
        masters={MASTERS}
        tailors={TAILORS}
        onChange={vi.fn()}
        onClear={onClear}
        onClose={onClose}
      />
    );
    await user.click(screen.getByText("Clear all"));
    expect(onClear).toHaveBeenCalled();
    await user.click(screen.getByText("Done"));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes via the X button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <OrderFiltersSheet
        open
        values={EMPTY_ORDER_FILTERS}
        masters={MASTERS}
        tailors={TAILORS}
        onChange={vi.fn()}
        onClear={vi.fn()}
        onClose={onClose}
      />
    );
    await user.click(screen.getByLabelText("Close filters"));
    expect(onClose).toHaveBeenCalled();
  });
});
