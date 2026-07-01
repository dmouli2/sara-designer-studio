import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSupabaseClient } from "../../supabase/client";
import { createSupabaseImageStorage } from "./imageStorage";

vi.mock("../../supabase/client", () => ({
  getSupabaseClient: vi.fn(),
}));

describe("createSupabaseImageStorage", () => {
  const upload = vi.fn();
  const createSignedUrl = vi.fn();
  const remove = vi.fn();
  const from = vi.fn(() => ({ upload, createSignedUrl, remove }));

  beforeEach(() => {
    upload.mockReset();
    createSignedUrl.mockReset();
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

  it("removes a stored object", async () => {
    remove.mockResolvedValue({ error: null });
    const storage = createSupabaseImageStorage();
    await storage.delete("orders/SDS-1/sketch.png");
    expect(remove).toHaveBeenCalledWith(["orders/SDS-1/sketch.png"]);
  });
});
