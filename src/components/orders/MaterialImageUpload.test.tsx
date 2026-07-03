import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MaterialImageUpload from "./MaterialImageUpload";
import { compressImageToDataUrl } from "@/lib/image";
import { MAX_MATERIAL_IMAGES } from "@/types";

vi.mock("@/lib/image", () => ({
  compressImageToDataUrl: vi.fn(),
}));

describe("MaterialImageUpload", () => {
  beforeEach(() => {
    vi.mocked(compressImageToDataUrl).mockReset();
  });

  it("shows the camera-first Take photo tile and a 0/max counter", () => {
    render(<MaterialImageUpload value={[]} onChange={() => {}} />);
    expect(screen.getByText("Take photo")).toBeInTheDocument();
    expect(
      screen.getByText(`0/${MAX_MATERIAL_IMAGES} photos · ${MAX_MATERIAL_IMAGES} more allowed`)
    ).toBeInTheDocument();
  });

  it("hints the rear camera via the capture attribute", () => {
    const { container } = render(<MaterialImageUpload value={[]} onChange={() => {}} />);
    expect(container.querySelector('input[type="file"]')).toHaveAttribute("capture", "environment");
  });

  it("compresses a captured photo and appends it", async () => {
    vi.mocked(compressImageToDataUrl).mockImplementation(
      async (file: File) => `data:image/jpeg;base64,${file.name}`
    );
    const onChange = vi.fn();
    const { container } = render(<MaterialImageUpload value={[]} onChange={onChange} />);
    const input = container.querySelector('input[type="file"]')!;

    fireEvent.change(input, { target: { files: [new File(["x"], "fabric.jpg", { type: "image/jpeg" })] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["data:image/jpeg;base64,fabric.jpg"]));
  });

  it("renders thumbnails labelled Material N with a remove button", () => {
    render(
      <MaterialImageUpload value={["data:image/jpeg;base64,a", "data:image/jpeg;base64,b"]} onChange={() => {}} />
    );
    expect(screen.getByAltText("Material 1")).toBeInTheDocument();
    expect(screen.getByAltText("Material 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove material photo 1")).toBeInTheDocument();
  });

  it("removes a photo when its remove button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MaterialImageUpload value={["data:image/jpeg;base64,a", "data:image/jpeg;base64,b"]} onChange={onChange} />
    );

    await user.click(screen.getByLabelText("Remove material photo 1"));
    expect(onChange).toHaveBeenCalledWith(["data:image/jpeg;base64,b"]);
  });

  it("hides the Take photo tile and shows 'limit reached' at the maximum", () => {
    const full = Array.from({ length: MAX_MATERIAL_IMAGES }, (_, i) => `data:image/jpeg;base64,${i}`);
    render(<MaterialImageUpload value={full} onChange={() => {}} />);
    expect(screen.queryByText("Take photo")).not.toBeInTheDocument();
    expect(
      screen.getByText(`${MAX_MATERIAL_IMAGES}/${MAX_MATERIAL_IMAGES} photos · limit reached`)
    ).toBeInTheDocument();
  });
});
