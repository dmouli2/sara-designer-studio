import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BlouseMeasurementForm, { emptyBlouse } from "./BlouseMeasurementForm";

describe("emptyBlouse", () => {
  it("returns a blank blouse measurements object with plain string fields", () => {
    const m = emptyBlouse();
    expect(m.type).toBe("blouse");
    expect(m.length).toBe("");
    expect(m.dart).toBe("");
  });
});

describe("BlouseMeasurementForm", () => {
  it("renders the L.B column header (no O.B) and field labels matching the physical order form", () => {
    render(<BlouseMeasurementForm value={emptyBlouse()} onChange={() => {}} />);
    expect(screen.getByText("L.B")).toBeInTheDocument();
    expect(screen.queryByText("O.B")).not.toBeInTheDocument();
    expect(screen.getByText("Length")).toBeInTheDocument();
    expect(screen.getByText("HS")).toBeInTheDocument();
    expect(screen.getByText("S.L")).toBeInTheDocument();
    expect(screen.getByText("MLOS")).toBeInTheDocument();
    expect(screen.getByText("TLOS")).toBeInTheDocument();
    expect(screen.getByText("AHS")).toBeInTheDocument();
    expect(screen.getByText("UB")).toBeInTheDocument();
    expect(screen.getByText("FN / NR")).toBeInTheDocument();
    expect(screen.getByText("BN")).toBeInTheDocument();
    expect(screen.getByText("DBD")).toBeInTheDocument();
    expect(screen.getByText("P")).toBeInTheDocument();
  });

  it("updates a measurement field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BlouseMeasurementForm value={emptyBlouse()} onChange={onChange} />);
    const shoulderInput = screen.getByText("Shoulder").parentElement!.querySelector("input")!;
    await user.type(shoulderInput, "1");
    expect(onChange).toHaveBeenCalledWith({ ...emptyBlouse(), shoulder: "1" });
  });

  it("updates the dart field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BlouseMeasurementForm value={emptyBlouse()} onChange={onChange} />);
    const dartInput = screen.getByText("Dart").parentElement!.querySelector("input")!;
    await user.type(dartInput, "1");
    expect(onChange).toHaveBeenCalledWith({ ...emptyBlouse(), dart: "1" });
  });
});
