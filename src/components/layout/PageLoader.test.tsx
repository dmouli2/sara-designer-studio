import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PageLoader from "./PageLoader";

describe("PageLoader", () => {
  it("renders a centered loading spinner", () => {
    render(<PageLoader />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});
