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

  it("serves app-page navigations cache-first and notifies pages when fresh content lands", async () => {
    const res = await GET();
    const body = await res.text();
    // Instant paint from cache, revalidate in the background…
    expect(body).toContain("NAV_UPDATED");
    expect(body).toContain("notifyNavUpdated");
    // …but never cache a redirected (session-expired) response under the page URL.
    expect(body).toContain("res.redirected");
  });

  it("keeps the session-dependent entry points network-first", async () => {
    const res = await GET();
    const body = await res.text();
    expect(body).toContain('url.pathname === "/" || url.pathname === "/login"');
  });

  it("never intercepts Next.js RSC data requests", async () => {
    const res = await GET();
    const body = await res.text();
    expect(body).toContain('url.searchParams.has("_rsc")');
    expect(body).toContain('request.headers.get("RSC")');
  });

  it("does not precache the root redirect in the shell", async () => {
    const res = await GET();
    const body = await res.text();
    const shellLine = body.split("\n").find((line) => line.startsWith("const SHELL"));
    expect(shellLine).toBeDefined();
    expect(shellLine).not.toContain('"/",');
    expect(shellLine).toContain('"/login"');
  });

  // Serving the cached copy resolves the fetch event. Without waitUntil the
  // browser may kill the worker before the revalidation's cache.put lands,
  // and every later visit gets the same stale page forever — an order handed
  // over on one device kept reading as untouched on the next visit.
  it("keeps the worker alive until a background revalidation has been cached", async () => {
    const body = await (await GET()).text();

    // Both stale-while-revalidate branches — app pages and static assets.
    expect(body.match(/event\.waitUntil\(/g)?.length).toBeGreaterThanOrEqual(4);
    expect(body).toContain("event.waitUntil(revalidate.catch(() => {}))");
    expect(body).toContain("event.waitUntil(assetNetwork.catch(() => {}))");

    // And the put is awaited inside that kept-alive promise, rather than
    // being left dangling.
    expect(body).toContain("await cache.put(request, res.clone())");
  });

  it("still refuses to cache a redirected page under its own URL", async () => {
    const body = await (await GET()).text();
    expect(body).toContain("res.ok && !res.redirected");
  });
});
