import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSupabaseClient } from "../../supabase/client";
import { createSupabaseLoginAttemptRepository } from "./loginAttemptRepository";

vi.mock("../../supabase/client", () => ({
  getSupabaseClient: vi.fn(),
}));

type QueryResult = { data: unknown; error: { message: string } | null };

function fakeQuery(result: QueryResult) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    upsert: vi.fn(() => Promise.resolve(result)),
    delete: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (r: QueryResult) => void) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

const row = {
  username: "anitha",
  failed_count: 3,
  locked_until: null,
  last_failure: "2026-08-30T10:00:00.000Z",
};

describe("createSupabaseLoginAttemptRepository", () => {
  const from = vi.fn();

  beforeEach(() => {
    from.mockReset();
    vi.mocked(getSupabaseClient).mockReturnValue({ from } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("get", () => {
    it("maps a stored row to attempt state", async () => {
      from.mockReturnValue(fakeQuery({ data: row, error: null }));
      const result = await createSupabaseLoginAttemptRepository().get("anitha");
      expect(result).toEqual({ failedCount: 3, lockedUntil: null });
    });

    it("returns null when the account has no failures on record", async () => {
      from.mockReturnValue(fakeQuery({ data: null, error: null }));
      const result = await createSupabaseLoginAttemptRepository().get("anitha");
      expect(result).toBeNull();
    });

    it("passes a lockout timestamp through", async () => {
      from.mockReturnValue(
        fakeQuery({ data: { ...row, locked_until: "2026-08-30T10:15:00.000Z" }, error: null })
      );
      const result = await createSupabaseLoginAttemptRepository().get("anitha");
      expect(result).toEqual({ failedCount: 3, lockedUntil: "2026-08-30T10:15:00.000Z" });
    });

    it("throws when the read fails", async () => {
      from.mockReturnValue(fakeQuery({ data: null, error: { message: "boom" } }));
      await expect(createSupabaseLoginAttemptRepository().get("anitha")).rejects.toThrow("boom");
    });
  });

  describe("recordFailure", () => {
    it("starts the count at one when there is no existing row", async () => {
      const q = fakeQuery({ data: null, error: null });
      from.mockReturnValue(q);

      const result = await createSupabaseLoginAttemptRepository().recordFailure("anitha", 5, 900_000);

      expect(result).toEqual({ failedCount: 1, lockedUntil: null });
      expect(q.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ username: "anitha", failed_count: 1, locked_until: null }),
        { onConflict: "username" }
      );
    });

    it("increments an existing count without locking below the threshold", async () => {
      const q = fakeQuery({ data: { ...row, failed_count: 2 }, error: null });
      from.mockReturnValue(q);

      const result = await createSupabaseLoginAttemptRepository().recordFailure("anitha", 5, 900_000);

      expect(result).toEqual({ failedCount: 3, lockedUntil: null });
    });

    it("locks the account once the failure count reaches the threshold", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-30T10:00:00.000Z"));
      const q = fakeQuery({ data: { ...row, failed_count: 4 }, error: null });
      from.mockReturnValue(q);

      const result = await createSupabaseLoginAttemptRepository().recordFailure("anitha", 5, 900_000);

      expect(result).toEqual({ failedCount: 5, lockedUntil: "2026-08-30T10:15:00.000Z" });
    });

    // Hammering a locked account must not let the attacker sit out one window
    // and then spend a fresh burst — every further failure pushes it back out.
    it("re-arms the lockout on every failure past the threshold", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-30T11:00:00.000Z"));
      const q = fakeQuery({ data: { ...row, failed_count: 9 }, error: null });
      from.mockReturnValue(q);

      const result = await createSupabaseLoginAttemptRepository().recordFailure("anitha", 5, 900_000);

      expect(result).toEqual({ failedCount: 10, lockedUntil: "2026-08-30T11:15:00.000Z" });
    });

    it("throws when the read fails", async () => {
      from.mockReturnValue(fakeQuery({ data: null, error: { message: "read boom" } }));
      await expect(
        createSupabaseLoginAttemptRepository().recordFailure("anitha", 5, 900_000)
      ).rejects.toThrow("read boom");
    });

    it("throws when the write fails", async () => {
      const builder: Record<string, unknown> = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: { message: "write boom" } })),
      };
      from.mockReturnValue(builder);

      await expect(
        createSupabaseLoginAttemptRepository().recordFailure("anitha", 5, 900_000)
      ).rejects.toThrow("write boom");
    });
  });

  describe("clear", () => {
    it("deletes the row for the username", async () => {
      const q = fakeQuery({ data: null, error: null });
      from.mockReturnValue(q);

      await createSupabaseLoginAttemptRepository().clear("anitha");

      expect(q.delete).toHaveBeenCalled();
      expect(q.eq).toHaveBeenCalledWith("username", "anitha");
    });

    it("throws when the delete fails", async () => {
      from.mockReturnValue(fakeQuery({ data: null, error: { message: "delete boom" } }));
      await expect(createSupabaseLoginAttemptRepository().clear("anitha")).rejects.toThrow(
        "delete boom"
      );
    });
  });
});
