import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MaterialImageGallery from "./MaterialImageGallery";

describe("MaterialImageGallery", () => {
  it("shows the empty state when there are no images", () => {
    render(<MaterialImageGallery images={[]} />);
    expect(screen.getByText("No material photos")).toBeInTheDocument();
  });

  it("renders a thumbnail per image, labelled Material N", () => {
    render(<MaterialImageGallery images={["a.jpg", "b.jpg"]} />);
    expect(screen.getByAltText("Material 1")).toBeInTheDocument();
    expect(screen.getByAltText("Material 2")).toBeInTheDocument();
  });

  it("opens the lightbox when a thumbnail is clicked", async () => {
    const user = userEvent.setup();
    render(<MaterialImageGallery images={["a.jpg"]} />);
    await user.click(screen.getByAltText("Material 1"));
    expect(screen.getByLabelText("Close")).toBeInTheDocument();
  });
});
