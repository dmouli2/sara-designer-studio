import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const createClientMock = vi.fn(() => ({ from: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

describe("getSupabaseClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockClear();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws when SUPABASE_URL is missing", async () => {
    delete process.env.SUPABASE_URL;
    const { getSupabaseClient } = await import("./client");
    expect(() => getSupabaseClient()).toThrow(/Missing SUPABASE_URL/);
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { getSupabaseClient } = await import("./client");
    expect(() => getSupabaseClient()).toThrow(/Missing SUPABASE_URL/);
  });

  it("constructs a client once and caches it across calls", async () => {
    const { getSupabaseClient } = await import("./client");
    const first = getSupabaseClient();
    const second = getSupabaseClient();
    expect(first).toBe(second);
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
      { auth: { persistSession: false } }
    );
  });

  it("resetSupabaseClientForTests forces a new client to be constructed", async () => {
    const { getSupabaseClient, resetSupabaseClientForTests } = await import("./client");
    getSupabaseClient();
    resetSupabaseClientForTests();
    getSupabaseClient();
    expect(createClientMock).toHaveBeenCalledTimes(2);
  });
});
