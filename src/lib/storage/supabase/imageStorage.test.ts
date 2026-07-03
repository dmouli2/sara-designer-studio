import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSupabaseClient } from "../../supabase/client";
import { createSupabaseImageStorage } from "./imageStorage";

vi.mock("../../supabase/client", () => ({
  getSupabaseClient: vi.fn(),
}));

describe("createSupabaseImageStorage", () => {
  const upload = vi.fn();
  const createSignedUrl = vi.fn();
  const createSignedUrls = vi.fn();
  const remove = vi.fn();
  const from = vi.fn(() => ({ upload, createSignedUrl, createSignedUrls, remove }));

  beforeEach(() => {
    upload.mockReset();
    createSignedUrl.mockReset();
    createSignedUrls.mockReset();
    remove.mockReset();
    from.mockClear();
    vi.mocked(getSupabaseClient).mockReturnValue({ storage: { from } } as never);
  });

  it("uploads a decoded data URL with the correct content type", async () => {
    upload.mockResolvedValue({ error: null });
    const storage = createSupabaseImageStorage();
    await storage.upload("orders/SDS-1/sketch.png", "data:image/png;base64,aGVsbG8=");

    expect(from).toHaveBeenCalledWith("order-images");
    expect(upload).toHaveBeenCalledWith(
      "orders/SDS-1/sketch.png",
      Buffer.from("aGVsbG8=", "base64"),
      { contentType: "image/png", upsert: true }
    );
  });

  it("throws for a malformed data URL", async () => {
    const storage = createSupabaseImageStorage();
    await expect(storage.upload("orders/SDS-1/sketch.png", "not-a-data-url")).rejects.toThrow(
      "Invalid data URL"
    );
    expect(upload).not.toHaveBeenCalled();
  });

  it("throws on an upload error", async () => {
    upload.mockResolvedValue({ error: { message: "upload failed" } });
    const storage = createSupabaseImageStorage();
    await expect(
      storage.upload("orders/SDS-1/sketch.png", "data:image/png;base64,aGVsbG8=")
    ).rejects.toThrow("upload failed");
  });

  it("resolves a signed URL", async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example/x" }, error: null });
    const storage = createSupabaseImageStorage();
    const url = await storage.getSignedUrl("orders/SDS-1/sketch.png");
    expect(url).toBe("https://signed.example/x");
    expect(createSignedUrl).toHaveBeenCalledWith("orders/SDS-1/sketch.png", 3600);
  });

  it("returns null when signing fails", async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: { message: "not found" } });
    const storage = createSupabaseImageStorage();
    expect(await storage.getSignedUrl("orders/missing.png")).toBeNull();
  });

  it("returns null when signing succeeds with no url", async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: null });
    const storage = createSupabaseImageStorage();
    expect(await storage.getSignedUrl("orders/missing.png")).toBeNull();
  });

  it("resolves multiple signed URLs in one batch call, matched by path", async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: "orders/SDS-2/material-1.jpg", signedUrl: "https://signed.example/2", error: null },
        { path: "orders/SDS-1/material-1.jpg", signedUrl: "https://signed.example/1", error: null },
      ],
      error: null,
    });
    const storage = createSupabaseImageStorage();
    const urls = await storage.getSignedUrls(["orders/SDS-1/material-1.jpg", "orders/SDS-2/material-1.jpg"]);

    expect(createSignedUrls).toHaveBeenCalledWith(
      ["orders/SDS-1/material-1.jpg", "orders/SDS-2/material-1.jpg"],
      3600
    );
    // Response order deliberately reversed vs. request — result must still
    // line up with the requested path order, not the response order.
    expect(urls).toEqual(["https://signed.example/1", "https://signed.example/2"]);
  });

  it("returns an empty array without calling the API for an empty path list", async () => {
    const storage = createSupabaseImageStorage();
    expect(await storage.getSignedUrls([])).toEqual([]);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("returns all nulls when the batch call fails", async () => {
    createSignedUrls.mockResolvedValue({ data: null, error: { message: "batch failed" } });
    const storage = createSupabaseImageStorage();
    expect(await storage.getSignedUrls(["a.jpg", "b.jpg"])).toEqual([null, null]);
  });

  it("maps a path missing from the response to null", async () => {
    createSignedUrls.mockResolvedValue({
      data: [{ path: "a.jpg", signedUrl: "https://signed.example/a", error: null }],
      error: null,
    });
    const storage = createSupabaseImageStorage();
    expect(await storage.getSignedUrls(["a.jpg", "b.jpg"])).toEqual(["https://signed.example/a", null]);
  });

  it("removes a stored object", async () => {
    remove.mockResolvedValue({ error: null });
    const storage = createSupabaseImageStorage();
    await storage.delete("orders/SDS-1/sketch.png");
    expect(remove).toHaveBeenCalledWith(["orders/SDS-1/sketch.png"]);
  });
});
