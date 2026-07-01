import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReferenceImageUpload from "./ReferenceImageUpload";
import { compressImageToDataUrl } from "@/lib/image";

vi.mock("@/lib/image", () => ({
  compressImageToDataUrl: vi.fn(),
}));

class FakeFileReader {
  onload: (() => void) | null = null;
  result: string | ArrayBuffer | null = null;
  readAsDataURL() {
    this.result = "data:image/png;base64,filedata";
    this.onload?.();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ReferenceImageUpload", () => {
  beforeEach(() => {
    vi.mocked(compressImageToDataUrl).mockReset();
  });

  it("shows the empty-state prompt when there is no value", () => {
    render(<ReferenceImageUpload value={null} onChange={() => {}} />);
    expect(screen.getByText("Tap to add reference photo")).toBeInTheDocument();
  });

  it("opens the file picker when the empty-state button is clicked", async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    render(<ReferenceImageUpload value={null} onChange={() => {}} />);
    await user.click(screen.getByText("Tap to add reference photo"));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("compresses the selected file and calls onChange with the compressed data URL", async () => {
    vi.mocked(compressImageToDataUrl).mockResolvedValue("data:image/jpeg;base64,compressed");
    const onChange = vi.fn();
    const { container } = render(<ReferenceImageUpload value={null} onChange={onChange} />);
    const input = container.querySelector('input[type="file"]')!;
    const file = new File(["content"], "photo.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("data:image/jpeg;base64,compressed"));
    expect(compressImageToDataUrl).toHaveBeenCalledWith(file);
  });

  it("shows a processing state while compression is in flight", async () => {
    let resolveCompression: (v: string) => void = () => {};
    vi.mocked(compressImageToDataUrl).mockReturnValue(
      new Promise((resolve) => {
        resolveCompression = resolve;
      })
    );
    const { container } = render(<ReferenceImageUpload value={null} onChange={() => {}} />);
    const input = container.querySelector('input[type="file"]')!;
    const file = new File(["content"], "photo.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("Processing photo…")).toBeInTheDocument();
    resolveCompression("data:image/jpeg;base64,done");
    await waitFor(() => expect(screen.queryByText("Processing photo…")).not.toBeInTheDocument());
  });

  it("shows a processing state on the Change photo button when replacing an existing image", async () => {
    let resolveCompression: (v: string) => void = () => {};
    vi.mocked(compressImageToDataUrl).mockReturnValue(
      new Promise((resolve) => {
        resolveCompression = resolve;
      })
    );
    const { container } = render(
      <ReferenceImageUpload value="data:image/png;base64,existing" onChange={() => {}} />
    );
    const input = container.querySelector('input[type="file"]')!;
    const file = new File(["content"], "photo.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("Processing…")).toBeInTheDocument();
    resolveCompression("data:image/jpeg;base64,done");
    await waitFor(() => expect(screen.getByText("Change photo")).toBeInTheDocument());
  });

  it("falls back to reading the raw file when compression fails", async () => {
    vi.stubGlobal("FileReader", FakeFileReader);
    vi.mocked(compressImageToDataUrl).mockRejectedValue(new Error("nope"));
    const onChange = vi.fn();
    const { container } = render(<ReferenceImageUpload value={null} onChange={onChange} />);
    const input = container.querySelector('input[type="file"]')!;
    const file = new File(["content"], "photo.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("data:image/png;base64,filedata"));
  });

  it("does nothing when the change event has no file", () => {
    const onChange = vi.fn();
    const { container } = render(<ReferenceImageUpload value={null} onChange={onChange} />);
    const input = container.querySelector('input[type="file"]')!;

    fireEvent.change(input, { target: { files: [] } });

    expect(onChange).not.toHaveBeenCalled();
    expect(compressImageToDataUrl).not.toHaveBeenCalled();
  });

  it("shows the preview image with change/remove actions when a value is set", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    render(<ReferenceImageUpload value="data:image/png;base64,existing" onChange={onChange} />);

    expect(screen.getByAltText("Reference")).toHaveAttribute("src", "data:image/png;base64,existing");

    await user.click(screen.getByText("Change photo"));
    expect(clickSpy).toHaveBeenCalled();

    await user.click(screen.getByText("Remove"));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
