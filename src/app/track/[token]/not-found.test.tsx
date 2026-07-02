import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TrackOrderNotFound from "./not-found";

describe("TrackOrderNotFound", () => {
  it("tells the visitor the tracking link is invalid or the order is gone", () => {
    render(<TrackOrderNotFound />);
    expect(screen.getByText("Order not found")).toBeInTheDocument();
    expect(
      screen.getByText("This tracking link is invalid or the order no longer exists.")
    ).toBeInTheDocument();
  });
});
