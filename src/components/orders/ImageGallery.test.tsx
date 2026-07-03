import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImageGallery from "./ImageGallery";

const props = { altPrefix: "Photo", emptyIcon: "📷", emptyText: "No photos" };

describe("ImageGallery", () => {
  it("shows the empty state (icon + text) when there are no images", () => {
    render(<ImageGallery images={[]} {...props} />);
    expect(screen.getByText("📷")).toBeInTheDocument();
    expect(screen.getByText("No photos")).toBeInTheDocument();
  });

  it("renders a thumbnail button per image, labelled with the alt prefix", () => {
    render(<ImageGallery images={["a.jpg", "b.jpg", "c.jpg"]} {...props} />);
    expect(screen.getByAltText("Photo 1")).toBeInTheDocument();
    expect(screen.getByAltText("Photo 2")).toBeInTheDocument();
    expect(screen.getByAltText("Photo 3")).toBeInTheDocument();
  });

  it("opens the lightbox with the clicked image when a thumbnail is clicked", async () => {
    const user = userEvent.setup();
    render(<ImageGallery images={["a.jpg", "b.jpg"]} {...props} />);

    await user.click(screen.getByAltText("Photo 2"));

    expect(screen.getByLabelText("Close")).toBeInTheDocument();
    const lightboxImage = screen.getAllByAltText("Photo 2")[1];
    expect(lightboxImage).toHaveAttribute("src", "b.jpg");
  });

  it("closes the lightbox when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(<ImageGallery images={["a.jpg"]} {...props} />);

    await user.click(screen.getByAltText("Photo 1"));
    expect(screen.getByLabelText("Close")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Close"));
    expect(screen.queryByLabelText("Close")).not.toBeInTheDocument();
  });

  it("hides prev/next navigation when there is only one image", async () => {
    const user = userEvent.setup();
    render(<ImageGallery images={["a.jpg"]} {...props} />);
    await user.click(screen.getByAltText("Photo 1"));

    expect(screen.queryByLabelText("Previous photo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Next photo")).not.toBeInTheDocument();
  });

  it("navigates to the next image and wraps around to the first", async () => {
    const user = userEvent.setup();
    render(<ImageGallery images={["a.jpg", "b.jpg", "c.jpg"]} {...props} />);
    await user.click(screen.getByAltText("Photo 1"));

    await user.click(screen.getByLabelText("Next photo"));
    expect(screen.getAllByAltText("Photo 2")[1]).toHaveAttribute("src", "b.jpg");

    await user.click(screen.getByLabelText("Next photo"));
    expect(screen.getAllByAltText("Photo 3")[1]).toHaveAttribute("src", "c.jpg");

    await user.click(screen.getByLabelText("Next photo"));
    expect(screen.getAllByAltText("Photo 1")[1]).toHaveAttribute("src", "a.jpg");
  });

  it("navigates to the previous image and wraps around to the last", async () => {
    const user = userEvent.setup();
    render(<ImageGallery images={["a.jpg", "b.jpg", "c.jpg"]} {...props} />);
    await user.click(screen.getByAltText("Photo 1"));

    await user.click(screen.getByLabelText("Previous photo"));
    expect(screen.getAllByAltText("Photo 3")[1]).toHaveAttribute("src", "c.jpg");
  });
});
