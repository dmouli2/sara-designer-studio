import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Loading from "./loading";

describe("Loading", () => {
  it("renders a page loader while the route segment streams in", () => {
    render(<Loading />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});
