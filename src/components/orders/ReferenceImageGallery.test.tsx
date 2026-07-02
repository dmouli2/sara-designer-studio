import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReferenceImageGallery from "./ReferenceImageGallery";

describe("ReferenceImageGallery", () => {
  it("shows the empty state when there are no images", () => {
    render(<ReferenceImageGallery images={[]} />);
    expect(screen.getByText("No reference photos")).toBeInTheDocument();
  });

  it("renders a thumbnail button per image", () => {
    render(<ReferenceImageGallery images={["a.jpg", "b.jpg", "c.jpg"]} />);
    expect(screen.getByAltText("Reference 1")).toBeInTheDocument();
    expect(screen.getByAltText("Reference 2")).toBeInTheDocument();
    expect(screen.getByAltText("Reference 3")).toBeInTheDocument();
  });

  it("opens the lightbox with the clicked image when a thumbnail is clicked", async () => {
    const user = userEvent.setup();
    render(<ReferenceImageGallery images={["a.jpg", "b.jpg"]} />);

    await user.click(screen.getByAltText("Reference 2"));

    expect(screen.getByLabelText("Close")).toBeInTheDocument();
    const lightboxImage = screen.getAllByAltText("Reference 2")[1];
    expect(lightboxImage).toHaveAttribute("src", "b.jpg");
  });

  it("closes the lightbox when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(<ReferenceImageGallery images={["a.jpg"]} />);

    await user.click(screen.getByAltText("Reference 1"));
    expect(screen.getByLabelText("Close")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Close"));
    expect(screen.queryByLabelText("Close")).not.toBeInTheDocument();
  });

  it("hides prev/next navigation when there is only one image", async () => {
    const user = userEvent.setup();
    render(<ReferenceImageGallery images={["a.jpg"]} />);
    await user.click(screen.getByAltText("Reference 1"));

    expect(screen.queryByLabelText("Previous photo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Next photo")).not.toBeInTheDocument();
  });

  it("navigates to the next image and wraps around to the first", async () => {
    const user = userEvent.setup();
    render(<ReferenceImageGallery images={["a.jpg", "b.jpg", "c.jpg"]} />);
    await user.click(screen.getByAltText("Reference 1"));

    await user.click(screen.getByLabelText("Next photo"));
    expect(screen.getAllByAltText("Reference 2")[1]).toHaveAttribute("src", "b.jpg");

    await user.click(screen.getByLabelText("Next photo"));
    expect(screen.getAllByAltText("Reference 3")[1]).toHaveAttribute("src", "c.jpg");

    await user.click(screen.getByLabelText("Next photo"));
    expect(screen.getAllByAltText("Reference 1")[1]).toHaveAttribute("src", "a.jpg");
  });

  it("navigates to the previous image and wraps around to the last", async () => {
    const user = userEvent.setup();
    render(<ReferenceImageGallery images={["a.jpg", "b.jpg", "c.jpg"]} />);
    await user.click(screen.getByAltText("Reference 1"));

    await user.click(screen.getByLabelText("Previous photo"));
    expect(screen.getAllByAltText("Reference 3")[1]).toHaveAttribute("src", "c.jpg");
  });
});
