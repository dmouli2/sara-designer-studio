import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GenericMeasurementForm, { emptyGeneric } from "./GenericMeasurementForm";

describe("emptyGeneric", () => {
  it("returns a blank generic measurements object", () => {
    expect(emptyGeneric()).toEqual({
      type: "generic",
      bust: "", waist: "", hip: "", length: "",
      shoulder: "", sleeve: "", neckDepth: "", armRound: "",
    });
  });
});

describe("GenericMeasurementForm", () => {
  it("renders an input for every field with its current value", () => {
    const value = { ...emptyGeneric(), bust: "34" };
    render(<GenericMeasurementForm value={value} onChange={() => {}} />);
    expect(screen.getByText("Bust")).toBeInTheDocument();
    expect(screen.getByText("Arm Round")).toBeInTheDocument();
    expect(screen.getByDisplayValue("34")).toBeInTheDocument();
  });

  it("calls onChange with the updated field when an input changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GenericMeasurementForm value={emptyGeneric()} onChange={onChange} />);
    const waistInput = screen.getByText("Waist").parentElement!.querySelector("input")!;
    await user.type(waistInput, "3");
    expect(onChange).toHaveBeenCalledWith({ ...emptyGeneric(), waist: "3" });
  });
});
