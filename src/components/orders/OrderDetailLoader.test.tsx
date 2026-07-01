import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import OrderDetailLoader from "./OrderDetailLoader";

describe("OrderDetailLoader", () => {
  it("renders an accessible loading status", () => {
    render(<OrderDetailLoader />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("renders a detail-shaped skeleton with a measurement grid and image placeholders", () => {
    const { container } = render(<OrderDetailLoader />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(10);
    expect(container.querySelectorAll(".grid-cols-3").length).toBeGreaterThan(0);
  });
});
