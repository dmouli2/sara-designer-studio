import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import EventDateField, { isInvalidEventDate } from "./EventDateField";
import { shopToday } from "@/lib/utils";

describe("isInvalidEventDate", () => {
  // The one rule every recorded date shares: it has to have happened.
  it("rejects an empty or future date and accepts today or earlier", () => {
    expect(isInvalidEventDate("")).toBe(true);
    expect(isInvalidEventDate("2099-01-01")).toBe(true);
    expect(isInvalidEventDate(shopToday())).toBe(false);
    expect(isInvalidEventDate("2020-01-01")).toBe(false);
  });
});

describe("EventDateField", () => {
  function setup(value: string) {
    const onChange = vi.fn();
    render(<EventDateField id="f" label="Handed over on" value={value} onChange={onChange} />);
    return { onChange };
  }

  it("renders the label and value", () => {
    setup("2026-08-20");
    expect(screen.getByLabelText("Handed over on")).toHaveValue("2026-08-20");
  });

  // The picker itself won't offer a future day, so the warning is only for a
  // value typed or pasted in.
  it("caps the picker at today", () => {
    setup("2026-08-20");
    expect(screen.getByLabelText("Handed over on")).toHaveAttribute("max", shopToday());
  });

  it("warns on a future date", () => {
    setup("2099-01-01");
    expect(screen.getByText(/hasn't happened yet/)).toBeInTheDocument();
  });

  it("stays quiet for a valid date", () => {
    setup("2020-01-01");
    expect(screen.queryByText(/hasn't happened yet/)).not.toBeInTheDocument();
  });

  it("reports changes", () => {
    const { onChange } = setup("2026-08-20");
    fireEvent.change(screen.getByLabelText("Handed over on"), { target: { value: "2026-08-21" } });
    expect(onChange).toHaveBeenCalledWith("2026-08-21");
  });
});
