import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BlouseMeasurementForm, { emptyBlouse } from "./BlouseMeasurementForm";

describe("emptyBlouse", () => {
  it("returns a blank blouse measurements object", () => {
    const m = emptyBlouse();
    expect(m.type).toBe("blouse");
    expect(m.length).toEqual({ lb: "", ob: "" });
    expect(m.dart).toBe("");
  });
});

describe("BlouseMeasurementForm", () => {
  it("renders the dual-field table headers and single fields", () => {
    render(<BlouseMeasurementForm value={emptyBlouse()} onChange={() => {}} />);
    expect(screen.getByText("L.B")).toBeInTheDocument();
    expect(screen.getByText("O.B")).toBeInTheDocument();
    expect(screen.getByText("Length")).toBeInTheDocument();
    expect(screen.getByText("Dist. Between Darts")).toBeInTheDocument();
  });

  it("updates the lb side of a dual field independently", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BlouseMeasurementForm value={emptyBlouse()} onChange={onChange} />);
    const row = screen.getByText("Shoulder").closest("div")!;
    const [lbInput] = row.querySelectorAll("input");
    await user.type(lbInput, "1");
    expect(onChange).toHaveBeenCalledWith({
      ...emptyBlouse(),
      shoulder: { lb: "1", ob: "" },
    });
  });

  it("updates the ob side of a dual field independently", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BlouseMeasurementForm value={emptyBlouse()} onChange={onChange} />);
    const row = screen.getByText("Bust").closest("div")!;
    const [, obInput] = row.querySelectorAll("input");
    await user.type(obInput, "9");
    expect(onChange).toHaveBeenCalledWith({
      ...emptyBlouse(),
      bust: { lb: "", ob: "9" },
    });
  });

  it("updates a single-value field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BlouseMeasurementForm value={emptyBlouse()} onChange={onChange} />);
    const dartInput = screen.getByText("Dart").parentElement!.querySelector("input")!;
    await user.type(dartInput, "1");
    expect(onChange).toHaveBeenCalledWith({ ...emptyBlouse(), dart: "1" });
  });
});
