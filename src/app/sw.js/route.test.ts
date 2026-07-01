import { describe, it, expect, afterEach, vi } from "vitest";
import { GET } from "./route";

describe("GET /sw.js", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("serves the worker script with no-cache headers", async () => {
    const res = await GET();
    expect(res.headers.get("Content-Type")).toBe("application/javascript; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-store, must-revalidate");
    expect(res.headers.get("Service-Worker-Allowed")).toBe("/");
  });

  it("stamps the cache version from the deployment commit sha when available", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abcdef1234567890");
    const res = await GET();
    const body = await res.text();
    expect(body).toContain('VERSION = "abcdef12"');
    expect(body).toContain("sara-studio-static-abcdef12");
    expect(body).toContain("sara-studio-runtime-abcdef12");
  });

  it("falls back to a timestamp-based version when no commit sha is set", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    vi.unstubAllEnvs();
    const original = process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    try {
      const res = await GET();
      const body = await res.text();
      expect(body).toMatch(/VERSION = "\d+"/);
    } finally {
      if (original !== undefined) process.env.VERCEL_GIT_COMMIT_SHA = original;
    }
  });

  it("includes the core service worker lifecycle handlers", async () => {
    const res = await GET();
    const body = await res.text();
    expect(body).toContain('self.addEventListener("install"');
    expect(body).toContain('self.addEventListener("activate"');
    expect(body).toContain('self.addEventListener("fetch"');
    expect(body).toContain('self.addEventListener("message"');
    expect(body).toContain("self.skipWaiting()");
    expect(body).toContain("self.clients.claim()");
    expect(body).toContain("/_next/static/");
    expect(body).toContain('request.mode === "navigate"');
  });
});
