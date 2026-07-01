import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "./StatusBadge";
import type { OrderStatus } from "@/types";

describe("StatusBadge", () => {
  const cases: [OrderStatus, string][] = [
    ["new", "New"],
    ["cutting", "Cutting"],
    ["cutting_done", "Cutting Done"],
    ["stitching", "Stitching"],
    ["ready", "Ready"],
    ["delivered", "Delivered"],
  ];

  it.each(cases)("renders the %s status as %s", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("falls back to the 'New' config for an unrecognized status", () => {
    render(<StatusBadge status={"unknown" as OrderStatus} />);
    expect(screen.getByText("New")).toBeInTheDocument();
  });
});
