import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SalwarMeasurementForm, { emptySalwar } from "./SalwarMeasurementForm";

describe("emptySalwar", () => {
  it("returns a blank salwar measurements object without the dropped O./L.Shalwar fields", () => {
    const m = emptySalwar();
    expect(m.type).toBe("salwar");
    expect(m.top.length).toBe("");
    expect(m.top.oShalwar).toBeUndefined();
    expect(m.top.lShalwar).toBeUndefined();
    expect(m.pant.hip).toBe("");
    expect(m.shawl).toBe("");
  });
});

describe("SalwarMeasurementForm", () => {
  // Same rule as the blouse book: UB is printed above B (Bust) and is always
  // the smaller number, so the form has to read in that order too.
  it("orders the top rows as the printed slip does, with UB above Bust", () => {
    render(<SalwarMeasurementForm value={emptySalwar()} onChange={() => {}} />);
    const labels = screen.getAllByRole("spinbutton").map((input) => input.getAttribute("aria-label"));
    expect(labels).toEqual([
      "Length", "Shoulder", "HS", "S.L", "TLCS", "AH",
      "UB", "Bust", "Waist", "Hip", "FN / NR", "BN",
    ]);
  });

  it("shows the top-measurement tab by default, without Height or the dropped O.Shalwar/L.Shalwar", () => {
    render(<SalwarMeasurementForm value={emptySalwar()} onChange={() => {}} />);
    expect(screen.getByText("TLCS")).toBeInTheDocument();
    expect(screen.queryByText("O.Shalwar")).not.toBeInTheDocument();
    expect(screen.queryByText("L.Shalwar")).not.toBeInTheDocument();
    expect(screen.queryByText("KL")).not.toBeInTheDocument();
    expect(screen.queryByText("Height")).not.toBeInTheDocument();
  });

  it("switches to the pant tab and shows pant fields plus shawl, with Height listed first", async () => {
    const user = userEvent.setup();
    render(<SalwarMeasurementForm value={emptySalwar()} onChange={() => {}} />);
    await user.click(screen.getByText("M. Pant"));
    expect(screen.getByText("KL")).toBeInTheDocument();
    expect(screen.getByText("Height")).toBeInTheDocument();
    expect(screen.getByText("Shawl")).toBeInTheDocument();
    expect(screen.queryByText("TLCS")).not.toBeInTheDocument();

    const fieldLabels = screen.getAllByText(/^(Height|Hip|Waist|KL|TL|Full Length|Yoke)$/).map((el) => el.textContent);
    expect(fieldLabels[0]).toBe("Height");
  });

  it("updates a top field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SalwarMeasurementForm value={emptySalwar()} onChange={onChange} />);
    await user.type(screen.getByLabelText("Length"), "5");
    expect(onChange).toHaveBeenCalledWith({
      ...emptySalwar(),
      top: { ...emptySalwar().top, length: "5" },
    });
  });

  it("updates a top field's note", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SalwarMeasurementForm value={emptySalwar()} onChange={onChange} />);
    await user.type(screen.getByLabelText("Bust note"), "x");
    expect(onChange).toHaveBeenCalledWith({
      ...emptySalwar(),
      topNotes: { bust: "x" },
    });
  });

  it("updates a pant field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SalwarMeasurementForm value={emptySalwar()} onChange={onChange} />);
    await user.click(screen.getByText("M. Pant"));
    await user.type(screen.getByLabelText("Yoke"), "1");
    expect(onChange).toHaveBeenCalledWith({
      ...emptySalwar(),
      pant: { ...emptySalwar().pant, yoke: "1" },
    });
  });

  it("updates a pant field's note, keeping existing notes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value = { ...emptySalwar(), pantNotes: { hip: "loose" } };
    render(<SalwarMeasurementForm value={value} onChange={onChange} />);
    await user.click(screen.getByText("M. Pant"));
    await user.type(screen.getByLabelText("KL note"), "y");
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      pantNotes: { hip: "loose", kl: "y" },
    });
  });

  it("shows existing notes in the note inputs", () => {
    const value = { ...emptySalwar(), topNotes: { waist: "with margin" } };
    render(<SalwarMeasurementForm value={value} onChange={() => {}} />);
    expect(screen.getByLabelText("Waist note")).toHaveValue("with margin");
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
