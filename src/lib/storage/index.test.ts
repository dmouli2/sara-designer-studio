import { describe, it, expect, vi, beforeEach } from "vitest";

const storageImpl = { upload: vi.fn(), getSignedUrl: vi.fn(), delete: vi.fn() };
const createSupabaseImageStorage = vi.fn(() => storageImpl);

vi.mock("./supabase/imageStorage", () => ({ createSupabaseImageStorage }));

describe("getImageStorage", () => {
  beforeEach(() => {
    vi.resetModules();
    createSupabaseImageStorage.mockClear();
  });

  it("constructs the adapter once and caches it", async () => {
    const { getImageStorage } = await import("./index");
    const first = getImageStorage();
    const second = getImageStorage();
    expect(first).toBe(second);
    expect(first).toBe(storageImpl);
    expect(createSupabaseImageStorage).toHaveBeenCalledTimes(1);
  });

  it("resetImageStorageForTests forces reconstruction", async () => {
    const { getImageStorage, resetImageStorageForTests } = await import("./index");
    getImageStorage();
    resetImageStorageForTests();
    getImageStorage();
    expect(createSupabaseImageStorage).toHaveBeenCalledTimes(2);
  });
});
