import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SalwarMeasurementForm, { emptySalwar } from "./SalwarMeasurementForm";

describe("emptySalwar", () => {
  it("returns a blank salwar measurements object", () => {
    const m = emptySalwar();
    expect(m.type).toBe("salwar");
    expect(m.top.oShalwar).toBe("");
    expect(m.pant.hip).toBe("");
    expect(m.shawl).toBe("");
  });
});

describe("SalwarMeasurementForm", () => {
  it("shows the top-measurement tab by default", () => {
    render(<SalwarMeasurementForm value={emptySalwar()} onChange={() => {}} />);
    expect(screen.getByText("O.Shalwar")).toBeInTheDocument();
    expect(screen.queryByText("KL")).not.toBeInTheDocument();
  });

  it("switches to the pant tab and shows pant fields plus shawl", async () => {
    const user = userEvent.setup();
    render(<SalwarMeasurementForm value={emptySalwar()} onChange={() => {}} />);
    await user.click(screen.getByText("M. Pant"));
    expect(screen.getByText("KL")).toBeInTheDocument();
    expect(screen.getByText("Shawl")).toBeInTheDocument();
    expect(screen.queryByText("O.Shalwar")).not.toBeInTheDocument();
  });

  it("updates a top field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SalwarMeasurementForm value={emptySalwar()} onChange={onChange} />);
    const row = screen.getByText("Length").closest("div")!;
    const input = row.querySelector("input")!;
    await user.type(input, "5");
    expect(onChange).toHaveBeenCalledWith({
      ...emptySalwar(),
      top: { ...emptySalwar().top, length: "5" },
    });
  });

  it("updates a pant field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SalwarMeasurementForm value={emptySalwar()} onChange={onChange} />);
    await user.click(screen.getByText("M. Pant"));
    const row = screen.getByText("Yoke").closest("div")!;
    const input = row.querySelector("input")!;
    await user.type(input, "1");
    expect(onChange).toHaveBeenCalledWith({
      ...emptySalwar(),
      pant: { ...emptySalwar().pant, yoke: "1" },
    });
  });

  it("updates the shawl free-text field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SalwarMeasurementForm value={emptySalwar()} onChange={onChange} />);
    await user.click(screen.getByText("M. Pant"));
    const shawlInput = screen.getByPlaceholderText("Given / details");
    await user.type(shawlInput, "x");
    expect(onChange).toHaveBeenCalledWith({ ...emptySalwar(), shawl: "x" });
  });
});
