import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { compressImageToDataUrl } from "./image";

class FakeImage {
  width = 3000;
  height = 2000;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

describe("compressImageToDataUrl", () => {
  const drawImage = vi.fn();
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalImage = globalThis.Image;

  beforeEach(() => {
    drawImage.mockClear();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage })) as never;
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
    globalThis.Image = FakeImage as never;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    globalThis.Image = originalImage;
  });

  it("scales an oversized image down to the max dimension, preserving aspect ratio", async () => {
    const file = new File(["fake"], "photo.jpg", { type: "image/jpeg" });
    const result = await compressImageToDataUrl(file, 1200, 0.7);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1200, 800);
    expect(result).toContain("data:image");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("does not upscale an image already smaller than the max dimension", async () => {
    class SmallImage extends FakeImage {
      width = 400;
      height = 300;
    }
    globalThis.Image = SmallImage as never;

    const file = new File(["fake"], "photo.jpg", { type: "image/jpeg" });
    await compressImageToDataUrl(file, 1200, 0.7);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 400, 300);
  });

  it("rejects when the canvas 2D context is unavailable", async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
    const file = new File(["fake"], "photo.jpg", { type: "image/jpeg" });
    await expect(compressImageToDataUrl(file)).rejects.toThrow("Canvas 2D context unavailable");
  });

  it("rejects and revokes the object URL when the image fails to load", async () => {
    class BrokenImage extends FakeImage {
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    globalThis.Image = BrokenImage as never;

    const file = new File(["fake"], "photo.jpg", { type: "image/jpeg" });
    await expect(compressImageToDataUrl(file)).rejects.toThrow("Failed to load image for compression");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});
