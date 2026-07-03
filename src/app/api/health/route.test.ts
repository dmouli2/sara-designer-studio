import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { getDb } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

describe("GET /api/health", () => {
  const staffList = vi.fn();

  beforeEach(() => {
    staffList.mockReset();
    vi.mocked(getDb).mockReturnValue({ staff: { list: staffList } } as never);
  });

  it("returns ok after a successful database round trip", async () => {
    staffList.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(staffList).toHaveBeenCalledWith({ activeOnly: true });
  });

  it("returns 503 when the database is unreachable", async () => {
    staffList.mockRejectedValue(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
  });
});
