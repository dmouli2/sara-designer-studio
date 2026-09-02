import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SampleGarmentNote from "./SampleGarmentNote";

describe("SampleGarmentNote", () => {
  it("names the garment after the book the order is in", () => {
    const { rerender } = render(<SampleGarmentNote dress="Blouse" />);
    expect(screen.getByText("Measurement blouse with us")).toBeInTheDocument();

    rerender(<SampleGarmentNote dress="Salwar" />);
    expect(screen.getByText("Measurement salwar with us")).toBeInTheDocument();
  });

  // Each reader needs a different thing from the same fact — see the
  // audience note in the component.
  it("tells the shop it is the customer's garment and has to go back", () => {
    render(<SampleGarmentNote dress="Blouse" />);
    expect(screen.getByText(/hand it back with the order/i)).toBeInTheDocument();
    expect(screen.getByText(/no measurements were taken/i)).toBeInTheDocument();
  });

  it("tells the workshop to cut to the garment rather than look for numbers", () => {
    render(<SampleGarmentNote dress="Salwar" audience="workshop" />);
    expect(screen.getByText(/cut to it/i)).toBeInTheDocument();
    expect(screen.getByText(/measurement salwar is with the order/i)).toBeInTheDocument();
    // Never the shop-side instruction — the tailor isn't the one handing it back.
    expect(screen.queryByText(/hand it back/i)).not.toBeInTheDocument();
  });

  it("reassures the customer that their own garment is coming back", () => {
    render(<SampleGarmentNote dress="Blouse" audience="customer" />);
    expect(screen.getByText(/safe with us and comes back to you/i)).toBeInTheDocument();
    // The customer is never told what the shop should do with it.
    expect(screen.queryByText(/cut to it/i)).not.toBeInTheDocument();
  });

  // Measuring is optional on these orders, so a flat "no measurements were
  // taken" would be a lie sitting directly above a list of them.
  describe("when the order also carries measurements", () => {
    it("calls them adjustments for the shop", () => {
      render(<SampleGarmentNote dress="Blouse" hasMeasurements />);
      expect(screen.getByText(/anything below is an adjustment to it/i)).toBeInTheDocument();
      expect(screen.queryByText(/no measurements were taken/i)).not.toBeInTheDocument();
      // The garment is still the customer's, and still has to go back.
      expect(screen.getByText(/hand it back with the order/i)).toBeInTheDocument();
    });

    it("tells the workshop the figures are adjustments, not the whole garment", () => {
      render(<SampleGarmentNote dress="Salwar" audience="workshop" hasMeasurements />);
      expect(screen.getByText(/adjustments to it, not the whole garment/i)).toBeInTheDocument();
      expect(screen.getByText(/cut to it/i)).toBeInTheDocument();
      expect(screen.queryByText(/no measurements were taken/i)).not.toBeInTheDocument();
    });

    it("says exactly the same thing to the customer, who never sees measurements", () => {
      const { container } = render(<SampleGarmentNote dress="Blouse" audience="customer" />);
      const without = container.textContent;
      const { container: withMeas } = render(
        <SampleGarmentNote dress="Blouse" audience="customer" hasMeasurements />
      );
      expect(withMeas.textContent).toBe(without);
    });
  });
});
