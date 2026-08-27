import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScanCapture, { SCAN_MAX_DIMENSION, SCAN_JPEG_QUALITY } from "./ScanCapture";
import { createDraftFromScan } from "@/app/actions/drafts";
import { compressImageToDataUrl } from "@/lib/image";
import { mockRouter } from "../../../../../vitest.setup";

vi.mock("@/app/actions/drafts", () => ({ createDraftFromScan: vi.fn() }));
vi.mock("@/lib/image", () => ({
  MAX_PHOTO_PAYLOAD_BYTES: 3.5 * 1024 * 1024,
  compressImageToDataUrl: vi.fn(),
  dataUrlToFile: vi.fn(
    (dataUrl: string, filename: string) => new File(["decoded"], filename, { type: "image/jpeg" })
  ),
}));

async function captureScan(container: HTMLElement, dataUrl = "data:image/jpeg;base64,scan") {
  vi.mocked(compressImageToDataUrl).mockResolvedValue(dataUrl);
  const input = container.querySelector('input[type="file"]')!;
  fireEvent.change(input, {
    target: { files: [new File(["page"], "page.jpg", { type: "image/jpeg" })] },
  });
  await waitFor(() => expect(screen.getByAltText("Order slip scan 1")).toBeInTheDocument());
}

describe("ScanCapture", () => {
  beforeEach(() => {
    vi.mocked(createDraftFromScan).mockReset();
    vi.mocked(compressImageToDataUrl).mockReset();
  });

  it("shows capture tips and disables Read slip until a photo is taken", () => {
    render(<ScanCapture />);
    expect(screen.getByText("For an accurate read")).toBeInTheDocument();
    expect(screen.getByText("Read slip").closest("button")).toBeDisabled();
  });

  it("captures via the rear camera at scan resolution", async () => {
    const { container } = render(<ScanCapture />);
    const input = container.querySelector('input[type="file"]')!;
    expect(input).toHaveAttribute("capture", "environment");

    await captureScan(container);

    expect(compressImageToDataUrl).toHaveBeenCalledWith(
      expect.any(File),
      SCAN_MAX_DIMENSION,
      SCAN_JPEG_QUALITY
    );
    expect(screen.getByText("Read slip").closest("button")).toBeEnabled();
  });

  it("sends the photo as a multipart scan file and opens the prefilled wizard", async () => {
    vi.mocked(createDraftFromScan).mockResolvedValue({ ok: true, id: "d1" });
    const user = userEvent.setup();
    const { container } = render(<ScanCapture />);
    await captureScan(container);

    await user.click(screen.getByText("Read slip"));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/admin/orders/new?draft=d1"));
    const photos = vi.mocked(createDraftFromScan).mock.calls[0][0];
    expect(photos.get("scan")).toBeInstanceOf(File);
  });

  it("keeps the photo and shows the reason the server reported when reading fails", async () => {
    vi.mocked(createDraftFromScan).mockResolvedValue({
      ok: false,
      message: "The free scanning quota is busy right now — wait a minute and try again.",
    });
    const user = userEvent.setup();
    const { container } = render(<ScanCapture />);
    await captureScan(container);

    await user.click(screen.getByText("Read slip"));

    await waitFor(() =>
      expect(screen.getByText(/free scanning quota/)).toBeInTheDocument()
    );
    expect(screen.getByAltText("Order slip scan 1")).toBeInTheDocument();
    expect(screen.getByText("Read slip").closest("button")).toBeEnabled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("falls back to a connection message when the action itself can't be reached", async () => {
    vi.mocked(createDraftFromScan).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    const { container } = render(<ScanCapture />);
    await captureScan(container);

    await user.click(screen.getByText("Read slip"));

    await waitFor(() =>
      expect(screen.getByText(/Couldn't reach the server/)).toBeInTheDocument()
    );
    expect(screen.getByText("Read slip").closest("button")).toBeEnabled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("blocks photos over the payload limit before calling the server", async () => {
    const user = userEvent.setup();
    const { container } = render(<ScanCapture />);
    // ~5.6M base64 chars ≈ 4.2 MB decoded — over the 3.5 MB cap.
    await captureScan(container, `data:image/jpeg;base64,${"a".repeat(5_600_000)}`);

    await user.click(screen.getByText("Read slip"));

    expect(await screen.findByText(/too large to send/)).toBeInTheDocument();
    expect(createDraftFromScan).not.toHaveBeenCalled();
  });
});
