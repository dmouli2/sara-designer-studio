import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { legendLabel } from "./legendLabel";

describe("legendLabel", () => {
  it("renders the label text", () => {
    render(<>{legendLabel("Stitching")}</>);
    expect(screen.getByText("Stitching")).toBeInTheDocument();
  });

  // The whole point: recharts would otherwise paint this text in the series
  // colour, and half the palette is pale enough to vanish on a white card.
  it("paints the label in ink rather than in the series colour", () => {
    render(<>{legendLabel("Stitching")}</>);
    expect(screen.getByText("Stitching")).toHaveStyle({ color: "rgb(58, 58, 60)" });
  });

  it("handles a multi-word label", () => {
    render(<>{legendLabel("Part Delivered")}</>);
    expect(screen.getByText("Part Delivered")).toBeInTheDocument();
  });
});
