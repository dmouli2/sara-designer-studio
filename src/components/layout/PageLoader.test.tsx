import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PageLoader from "./PageLoader";

describe("PageLoader", () => {
  it("renders an accessible loading status", () => {
    render(<PageLoader />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("renders a skeleton screen instead of a spinner", () => {
    const { container } = render(<PageLoader />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(1);
  });
});
