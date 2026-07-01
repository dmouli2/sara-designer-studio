import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Spinner from "./Spinner";

describe("Spinner", () => {
  it("renders an accessible loading status", () => {
    render(<Spinner />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("defaults to a 32px size", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toHaveStyle({ width: "32px", height: "32px" });
  });

  it("applies a custom size when provided", () => {
    render(<Spinner size={64} />);
    expect(screen.getByRole("status")).toHaveStyle({ width: "64px", height: "64px" });
  });
});
