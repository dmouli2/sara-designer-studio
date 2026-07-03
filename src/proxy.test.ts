import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { decrypt } from "@/lib/session";
import { proxy, config } from "./proxy";

vi.mock("@/lib/session", () => ({
  decrypt: vi.fn(),
  SESSION_COOKIE_NAME: "sds_session",
}));

function makeRequest(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set("cookie", `sds_session=${cookie}`);
  return new NextRequest(new URL(`http://localhost${path}`), { headers });
}

describe("proxy matcher", () => {
  it("matches app routes", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "http://localhost/admin/orders" })).toBe(true);
  });

  it("excludes static assets and image files", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "http://localhost/_next/static/chunk.js" })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, url: "http://localhost/logo.png" })).toBe(false);
  });
});

describe("proxy", () => {
  beforeEach(() => {
    vi.mocked(decrypt).mockReset();
  });

  it("redirects unauthenticated requests on protected routes to /login", async () => {
    vi.mocked(decrypt).mockResolvedValue(null);
    const response = await proxy(makeRequest("/admin/orders"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("lets an unauthenticated request through to /login", async () => {
    vi.mocked(decrypt).mockResolvedValue(null);
    const response = await proxy(makeRequest("/login"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects an authenticated admin away from /login straight to the orders list", async () => {
    vi.mocked(decrypt).mockResolvedValue({ staffId: "s1", username: "admin", role: "admin", name: "Admin" });
    const response = await proxy(makeRequest("/login", "token"));
    expect(response.headers.get("location")).toBe("http://localhost/admin/orders");
  });

  it("redirects an authenticated user from the root path straight to their role home", async () => {
    vi.mocked(decrypt).mockResolvedValue({ staffId: "m1", username: "mouli", role: "master", name: "Mouli" });
    const response = await proxy(makeRequest("/", "token"));
    expect(response.headers.get("location")).toBe("http://localhost/master/queue");
  });

  it("redirects an unauthenticated request on the root path to /login", async () => {
    vi.mocked(decrypt).mockResolvedValue(null);
    const response = await proxy(makeRequest("/"));
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("redirects a non-admin authenticated user away from /login to their role queue", async () => {
    vi.mocked(decrypt).mockResolvedValue({ staffId: "t1", username: "anitha", role: "tailor", name: "Anitha K." });
    const response = await proxy(makeRequest("/login", "token"));
    expect(response.headers.get("location")).toBe("http://localhost/tailor/queue");
  });

  it("lets an authenticated request through to a protected route", async () => {
    vi.mocked(decrypt).mockResolvedValue({
      staffId: "s1",
      username: "anitha",
      role: "tailor",
      name: "Anitha K.",
    });
    const response = await proxy(makeRequest("/tailor/queue", "token"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("lets an unauthenticated request through to API routes, which do their own auth", async () => {
    vi.mocked(decrypt).mockResolvedValue(null);
    const response = await proxy(makeRequest("/api/health"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("lets an unauthenticated request through to a public order-tracking link", async () => {
    vi.mocked(decrypt).mockResolvedValue(null);
    const response = await proxy(makeRequest("/track/tok-abc123"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("lets a logged-in staff member open a public order-tracking link without redirecting them home", async () => {
    vi.mocked(decrypt).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    const response = await proxy(makeRequest("/track/tok-abc123", "token"));
    expect(response.headers.get("location")).toBeNull();
  });
});
