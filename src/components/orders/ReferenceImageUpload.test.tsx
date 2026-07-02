import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReferenceImageUpload from "./ReferenceImageUpload";
import { compressImageToDataUrl } from "@/lib/image";
import { MAX_REFERENCE_IMAGES } from "@/types";

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

function makeFiles(n: number): File[] {
  return Array.from({ length: n }, (_, i) => new File(["content"], `photo-${i}.png`, { type: "image/png" }));
}

describe("ReferenceImageUpload", () => {
  beforeEach(() => {
    vi.mocked(compressImageToDataUrl).mockReset();
  });

  it("shows the empty state with the Add tile and a 0/max counter", () => {
    render(<ReferenceImageUpload value={[]} onChange={() => {}} />);
    expect(screen.getByText("Add")).toBeInTheDocument();
    expect(screen.getByText(`0/${MAX_REFERENCE_IMAGES} photos · ${MAX_REFERENCE_IMAGES} more allowed`)).toBeInTheDocument();
  });

  it("opens the file picker when the Add tile is clicked", async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    render(<ReferenceImageUpload value={[]} onChange={() => {}} />);
    await user.click(screen.getByText("Add"));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("compresses selected files and appends them to the existing value", async () => {
    vi.mocked(compressImageToDataUrl).mockImplementation(
      async (file: File) => `data:image/jpeg;base64,${file.name}`
    );
    const onChange = vi.fn();
    const { container } = render(
      <ReferenceImageUpload value={["data:image/jpeg;base64,existing"]} onChange={onChange} />
    );
    const input = container.querySelector('input[type="file"]')!;
    const files = makeFiles(2);

    fireEvent.change(input, { target: { files } });

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        "data:image/jpeg;base64,existing",
        "data:image/jpeg;base64,photo-0.png",
        "data:image/jpeg;base64,photo-1.png",
      ])
    );
  });

  it("shows a processing state while compression is in flight", async () => {
    let resolveCompression: (v: string) => void = () => {};
    vi.mocked(compressImageToDataUrl).mockReturnValue(
      new Promise((resolve) => {
        resolveCompression = resolve;
      })
    );
    const { container } = render(<ReferenceImageUpload value={[]} onChange={() => {}} />);
    const input = container.querySelector('input[type="file"]')!;

    fireEvent.change(input, { target: { files: makeFiles(1) } });

    expect(await screen.findByText("Processing…")).toBeInTheDocument();
    resolveCompression("data:image/jpeg;base64,done");
    await waitFor(() => expect(screen.queryByText("Processing…")).not.toBeInTheDocument());
  });

  it("falls back to reading the raw file when compression fails", async () => {
    vi.stubGlobal("FileReader", FakeFileReader);
    vi.mocked(compressImageToDataUrl).mockRejectedValue(new Error("nope"));
    const onChange = vi.fn();
    const { container } = render(<ReferenceImageUpload value={[]} onChange={onChange} />);
    const input = container.querySelector('input[type="file"]')!;

    fireEvent.change(input, { target: { files: makeFiles(1) } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["data:image/png;base64,filedata"]));
  });

  it("does nothing when the change event has no files", () => {
    const onChange = vi.fn();
    const { container } = render(<ReferenceImageUpload value={[]} onChange={onChange} />);
    const input = container.querySelector('input[type="file"]')!;

    fireEvent.change(input, { target: { files: [] } });

    expect(onChange).not.toHaveBeenCalled();
    expect(compressImageToDataUrl).not.toHaveBeenCalled();
  });

  it("does nothing when the change event's files list is null", () => {
    const onChange = vi.fn();
    const { container } = render(<ReferenceImageUpload value={[]} onChange={onChange} />);
    const input = container.querySelector('input[type="file"]')!;

    fireEvent.change(input, { target: { files: null } });

    expect(onChange).not.toHaveBeenCalled();
    expect(compressImageToDataUrl).not.toHaveBeenCalled();
  });

  it("caps newly selected files to the remaining slots", async () => {
    vi.mocked(compressImageToDataUrl).mockImplementation(
      async (file: File) => `data:image/jpeg;base64,${file.name}`
    );
    const onChange = vi.fn();
    const existing = Array.from({ length: MAX_REFERENCE_IMAGES - 1 }, (_, i) => `data:image/jpeg;base64,existing-${i}`);
    const { container } = render(<ReferenceImageUpload value={existing} onChange={onChange} />);
    const input = container.querySelector('input[type="file"]')!;

    fireEvent.change(input, { target: { files: makeFiles(3) } });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0][0]).toHaveLength(MAX_REFERENCE_IMAGES);
    expect(compressImageToDataUrl).toHaveBeenCalledTimes(1);
  });

  it("renders a thumbnail per image with a remove button", () => {
    render(<ReferenceImageUpload value={["data:image/jpeg;base64,a", "data:image/jpeg;base64,b"]} onChange={() => {}} />);
    expect(screen.getByAltText("Reference 1")).toBeInTheDocument();
    expect(screen.getByAltText("Reference 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove reference photo 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove reference photo 2")).toBeInTheDocument();
  });

  it("removes an image when its remove button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ReferenceImageUpload
        value={["data:image/jpeg;base64,a", "data:image/jpeg;base64,b"]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByLabelText("Remove reference photo 1"));
    expect(onChange).toHaveBeenCalledWith(["data:image/jpeg;base64,b"]);
  });

  it("hides the Add tile and shows 'limit reached' once at the maximum", () => {
    const full = Array.from({ length: MAX_REFERENCE_IMAGES }, (_, i) => `data:image/jpeg;base64,${i}`);
    render(<ReferenceImageUpload value={full} onChange={() => {}} />);
    expect(screen.queryByText("Add")).not.toBeInTheDocument();
    expect(screen.getByText(`${MAX_REFERENCE_IMAGES}/${MAX_REFERENCE_IMAGES} photos · limit reached`)).toBeInTheDocument();
  });
});
