import { describe, it, expect, vi, beforeEach } from "vitest";

const staffRepo = { findByUsername: vi.fn() };
const orderRepo = { list: vi.fn() };
const createSupabaseStaffRepository = vi.fn(() => staffRepo);
const createSupabaseOrderRepository = vi.fn(() => orderRepo);

vi.mock("./supabase/staffRepository", () => ({ createSupabaseStaffRepository }));
vi.mock("./supabase/orderRepository", () => ({ createSupabaseOrderRepository }));

describe("getDb", () => {
  beforeEach(() => {
    vi.resetModules();
    createSupabaseStaffRepository.mockClear();
    createSupabaseOrderRepository.mockClear();
  });

  it("constructs repositories once and caches the result", async () => {
    const { getDb } = await import("./index");
    const first = getDb();
    const second = getDb();
    expect(first).toBe(second);
    expect(first.staff).toBe(staffRepo);
    expect(first.orders).toBe(orderRepo);
    expect(createSupabaseStaffRepository).toHaveBeenCalledTimes(1);
    expect(createSupabaseOrderRepository).toHaveBeenCalledTimes(1);
  });

  it("resetDbForTests forces reconstruction", async () => {
    const { getDb, resetDbForTests } = await import("./index");
    getDb();
    resetDbForTests();
    getDb();
    expect(createSupabaseStaffRepository).toHaveBeenCalledTimes(2);
  });
});
