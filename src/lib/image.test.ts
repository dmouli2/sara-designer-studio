import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { compressImageToDataUrl, dataUrlToFile, galleryEntryToFile, MAX_PHOTO_PAYLOAD_BYTES } from "./image";

describe("MAX_PHOTO_PAYLOAD_BYTES", () => {
  it("stays under the 4mb server action body cap with headroom", () => {
    expect(MAX_PHOTO_PAYLOAD_BYTES).toBe(3.5 * 1024 * 1024);
  });
});

describe("galleryEntryToFile", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("converts a data URL entry without fetching", async () => {
    globalThis.fetch = vi.fn();
    const file = await galleryEntryToFile("data:image/jpeg;base64,ZmFicmlj", "material-1.jpg");
    expect(file.name).toBe("material-1.jpg");
    expect(Buffer.from(await file.arrayBuffer()).toString()).toBe("fabric");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  // jsdom's Response rewrites blob content types, so fetch is faked with a
  // minimal { ok, status, blob } object to keep the types under test.
  it("fetches an existing photo back from its signed URL", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => new Blob(["stored"], { type: "image/png" }),
    })) as unknown as typeof fetch;
    const file = await galleryEntryToFile("https://storage.example/material-1.jpg?sig=1", "material-1.jpg");
    expect(globalThis.fetch).toHaveBeenCalledWith("https://storage.example/material-1.jpg?sig=1");
    expect(file.name).toBe("material-1.jpg");
    expect(file.type).toBe("image/png");
    expect(Buffer.from(await file.arrayBuffer()).toString()).toBe("stored");
  });

  it("defaults the type to image/jpeg when the response has no content type", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => new Blob(["stored"]),
    })) as unknown as typeof fetch;
    const file = await galleryEntryToFile("https://storage.example/material-1.jpg", "material-1.jpg");
    expect(file.type).toBe("image/jpeg");
  });

  it("throws when the signed URL fetch fails", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      blob: async () => new Blob(),
    })) as unknown as typeof fetch;
    await expect(galleryEntryToFile("https://storage.example/expired.jpg", "x.jpg")).rejects.toThrow(
      "Failed to fetch existing photo (403)"
    );
  });
});

describe("dataUrlToFile", () => {
  it("decodes a base64 data URL into a File with the right type, name and bytes", async () => {
    // "ZmFicmlj" is base64 for "fabric".
    const file = dataUrlToFile("data:image/jpeg;base64,ZmFicmlj", "material-1.jpg");
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("material-1.jpg");
    expect(file.type).toBe("image/jpeg");
    expect(Buffer.from(await file.arrayBuffer()).toString()).toBe("fabric");
  });

  it("preserves a png content type", () => {
    const file = dataUrlToFile("data:image/png;base64,aGVsbG8=", "sketch.png");
    expect(file.type).toBe("image/png");
  });

  it("throws on a malformed data URL", () => {
    expect(() => dataUrlToFile("not-a-data-url", "x.jpg")).toThrow("Invalid data URL");
    expect(() => dataUrlToFile("data:image/jpeg;utf8,plain", "x.jpg")).toThrow("Invalid data URL");
  });
});

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
