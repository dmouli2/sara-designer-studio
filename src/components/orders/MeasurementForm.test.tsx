import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MeasurementForm, { emptyMeasurementsForDress } from "./MeasurementForm";
import { emptyBlouse } from "./BlouseMeasurementForm";
import { emptySalwar } from "./SalwarMeasurementForm";

describe("emptyMeasurementsForDress", () => {
  it("returns empty salwar measurements for Salwar", () => {
    expect(emptyMeasurementsForDress("Salwar")).toEqual(emptySalwar());
  });

  it("defaults to empty blouse measurements otherwise", () => {
    expect(emptyMeasurementsForDress("Blouse")).toEqual(emptyBlouse());
    expect(emptyMeasurementsForDress("Anything")).toEqual(emptyBlouse());
  });
});

describe("MeasurementForm", () => {
  it("renders the blouse form when dress is Blouse and value matches", () => {
    render(<MeasurementForm dress="Blouse" value={emptyBlouse()} onChange={() => {}} />);
    expect(screen.getByText("L.B")).toBeInTheDocument();
  });

  it("renders the salwar form when dress is Salwar and value matches", () => {
    render(<MeasurementForm dress="Salwar" value={emptySalwar()} onChange={() => {}} />);
    expect(screen.getByText("TLCS")).toBeInTheDocument();
  });

  it("resets to fresh measurements and renders nothing when dress/value type mismatch", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MeasurementForm dress="Salwar" value={emptyBlouse()} onChange={onChange} />
    );
    expect(container).toBeEmptyDOMElement();
    expect(onChange).toHaveBeenCalledWith(emptySalwar());
  });
});
