import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { getDb } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  getImageStorage: vi.fn(),
}));

function makeRequest(authorization?: string): Request {
  const headers = new Headers();
  if (authorization) headers.set("authorization", authorization);
  return new Request("http://localhost/api/cleanup-images", { headers });
}

describe("GET /api/cleanup-images", () => {
  const listImageCleanupCandidates = vi.fn();
  const update = vi.fn();
  const storageDelete = vi.fn();

  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    listImageCleanupCandidates.mockReset();
    update.mockReset();
    storageDelete.mockReset();
    update.mockResolvedValue({});
    storageDelete.mockResolvedValue(undefined);
    vi.mocked(getDb).mockReturnValue({
      orders: { listImageCleanupCandidates, update },
    } as never);
    vi.mocked(getImageStorage).mockReturnValue({
      upload: vi.fn(),
      getSignedUrl: vi.fn(),
      getSignedUrls: vi.fn(),
      delete: storageDelete,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects requests without the cron secret", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(listImageCleanupCandidates).not.toHaveBeenCalled();
  });

  it("rejects requests with a wrong secret", async () => {
    const res = await GET(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("rejects every request when no CRON_SECRET is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(makeRequest("Bearer "));
    expect(res.status).toBe(401);
  });

  // The comparison is constant-time now, which means it must still behave
  // correctly for the shapes a naive === handled: a secret that is a prefix of
  // what was presented, and one that is longer than it.
  it("rejects a secret that is only a prefix of the real one", async () => {
    const res = await GET(makeRequest("Bearer cron-sec"));
    expect(res.status).toBe(401);
  });

  it("rejects a token longer than the real one", async () => {
    const res = await GET(makeRequest("Bearer cron-secret-and-then-some"));
    expect(res.status).toBe(401);
  });

  it("rejects a correct secret sent without the Bearer scheme", async () => {
    const res = await GET(makeRequest("cron-secret"));
    expect(res.status).toBe(401);
  });

  it("accepts the exact secret", async () => {
    listImageCleanupCandidates.mockResolvedValue([]);
    const res = await GET(makeRequest("Bearer cron-secret"));
    expect(res.status).toBe(200);
  });

  it("deletes stored images for old finished orders and blanks their columns", async () => {
    listImageCleanupCandidates.mockResolvedValue([
      {
        id: "B2401",
        sketchDataUrl: "orders/B2401/sketch.png",
        referenceImageUrls: ["orders/B2401/reference-1.jpg", "orders/B2401/reference-2.jpg"],
        materialImageUrls: ["orders/B2401/material-1.jpg"],
      },
    ]);

    const res = await GET(makeRequest("Bearer cron-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cleaned: 1 });

    expect(storageDelete).toHaveBeenCalledWith("orders/B2401/sketch.png");
    expect(storageDelete).toHaveBeenCalledWith("orders/B2401/reference-1.jpg");
    expect(storageDelete).toHaveBeenCalledWith("orders/B2401/reference-2.jpg");
    expect(storageDelete).toHaveBeenCalledWith("orders/B2401/material-1.jpg");
    expect(update).toHaveBeenCalledWith("B2401", {
      sketchDataUrl: null,
      referenceImageUrls: [],
      materialImageUrls: [],
    });

    const cutoffIso = listImageCleanupCandidates.mock.calls[0][0] as string;
    expect(new Date(cutoffIso).getTime()).toBeLessThan(Date.now());
  });

  it("skips storage deletion for legacy base64 values but still blanks the columns", async () => {
    listImageCleanupCandidates.mockResolvedValue([
      {
        id: "S2131",
        sketchDataUrl: "data:image/png;base64,legacy",
        referenceImageUrls: [],
        materialImageUrls: [],
      },
    ]);

    const res = await GET(makeRequest("Bearer cron-secret"));
    expect(res.status).toBe(200);
    expect(storageDelete).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith("S2131", {
      sketchDataUrl: null,
      referenceImageUrls: [],
      materialImageUrls: [],
    });
  });

  it("reports zero when there is nothing to clean", async () => {
    listImageCleanupCandidates.mockResolvedValue([]);
    const res = await GET(makeRequest("Bearer cron-secret"));
    expect(await res.json()).toEqual({ cleaned: 0 });
    expect(update).not.toHaveBeenCalled();
  });
});
