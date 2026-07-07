import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Plus } from "lucide-react";
import ImageUpload from "./ImageUpload";
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

function makeFiles(n: number): File[] {
  return Array.from({ length: n }, (_, i) => new File(["content"], `photo-${i}.png`, { type: "image/png" }));
}

const baseProps = {
  max: 4,
  altPrefix: "Photo",
  removeLabelPrefix: "Remove photo",
  addLabel: "Add",
  addIcon: Plus,
};

describe("ImageUpload", () => {
  beforeEach(() => {
    vi.mocked(compressImageToDataUrl).mockReset();
  });

  it("shows the empty state with the Add tile and a 0/max counter", () => {
    render(<ImageUpload value={[]} onChange={() => {}} {...baseProps} />);
    expect(screen.getByText("Add")).toBeInTheDocument();
    expect(screen.getByText("0/4 photos · 4 more allowed")).toBeInTheDocument();
  });

  it("sets the capture attribute on the file input when provided", () => {
    const { container } = render(
      <ImageUpload value={[]} onChange={() => {}} {...baseProps} capture="environment" />
    );
    expect(container.querySelector('input[type="file"]')).toHaveAttribute("capture", "environment");
  });

  it("omits the capture attribute when not provided", () => {
    const { container } = render(<ImageUpload value={[]} onChange={() => {}} {...baseProps} />);
    expect(container.querySelector('input[type="file"]')).not.toHaveAttribute("capture");
  });

  it("opens the file picker when the Add tile is clicked", async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    render(<ImageUpload value={[]} onChange={() => {}} {...baseProps} />);
    await user.click(screen.getByText("Add"));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("compresses selected files and appends them to the existing value", async () => {
    vi.mocked(compressImageToDataUrl).mockImplementation(
      async (file: File) => `data:image/jpeg;base64,${file.name}`
    );
    const onChange = vi.fn();
    const { container } = render(
      <ImageUpload value={["data:image/jpeg;base64,existing"]} onChange={onChange} {...baseProps} />
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
    const { container } = render(<ImageUpload value={[]} onChange={() => {}} {...baseProps} />);
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
    const { container } = render(<ImageUpload value={[]} onChange={onChange} {...baseProps} />);
    const input = container.querySelector('input[type="file"]')!;

    fireEvent.change(input, { target: { files: makeFiles(1) } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["data:image/png;base64,filedata"]));
  });

  it("does nothing when the change event has no files", () => {
    const onChange = vi.fn();
    const { container } = render(<ImageUpload value={[]} onChange={onChange} {...baseProps} />);
    const input = container.querySelector('input[type="file"]')!;

    fireEvent.change(input, { target: { files: [] } });

    expect(onChange).not.toHaveBeenCalled();
    expect(compressImageToDataUrl).not.toHaveBeenCalled();
  });

  it("does nothing when the change event's files list is null", () => {
    const onChange = vi.fn();
    const { container } = render(<ImageUpload value={[]} onChange={onChange} {...baseProps} />);
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
    const existing = Array.from({ length: baseProps.max - 1 }, (_, i) => `data:image/jpeg;base64,existing-${i}`);
    const { container } = render(<ImageUpload value={existing} onChange={onChange} {...baseProps} />);
    const input = container.querySelector('input[type="file"]')!;

    fireEvent.change(input, { target: { files: makeFiles(3) } });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0][0]).toHaveLength(baseProps.max);
    expect(compressImageToDataUrl).toHaveBeenCalledTimes(1);
  });

  it("renders a thumbnail per image with a remove button", () => {
    render(
      <ImageUpload
        value={["data:image/jpeg;base64,a", "data:image/jpeg;base64,b"]}
        onChange={() => {}}
        {...baseProps}
      />
    );
    expect(screen.getByAltText("Photo 1")).toBeInTheDocument();
    expect(screen.getByAltText("Photo 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove photo 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove photo 2")).toBeInTheDocument();
  });

  it("removes an image when its remove button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ImageUpload
        value={["data:image/jpeg;base64,a", "data:image/jpeg;base64,b"]}
        onChange={onChange}
        {...baseProps}
      />
    );

    await user.click(screen.getByLabelText("Remove photo 1"));
    expect(onChange).toHaveBeenCalledWith(["data:image/jpeg;base64,b"]);
  });

  it("hides the Add tile and shows 'limit reached' once at the maximum", () => {
    const full = Array.from({ length: baseProps.max }, (_, i) => `data:image/jpeg;base64,${i}`);
    render(<ImageUpload value={full} onChange={() => {}} {...baseProps} />);
    expect(screen.queryByText("Add")).not.toBeInTheDocument();
    expect(screen.getByText("4/4 photos · limit reached")).toBeInTheDocument();
  });

  it("passes compression overrides through to compressImageToDataUrl", async () => {
    vi.mocked(compressImageToDataUrl).mockResolvedValue("data:image/jpeg;base64,big");
    const { container } = render(
      <ImageUpload value={[]} onChange={vi.fn()} {...baseProps} maxDimension={2800} quality={0.85} />
    );

    const [file] = makeFiles(1);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });

    await waitFor(() => expect(compressImageToDataUrl).toHaveBeenCalledWith(file, 2800, 0.85));
  });

  it("uses default compression when no overrides are given", async () => {
    vi.mocked(compressImageToDataUrl).mockResolvedValue("data:image/jpeg;base64,x");
    const { container } = render(<ImageUpload value={[]} onChange={vi.fn()} {...baseProps} />);

    const [file] = makeFiles(1);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });

    await waitFor(() => expect(compressImageToDataUrl).toHaveBeenCalledWith(file, undefined, undefined));
  });
});
