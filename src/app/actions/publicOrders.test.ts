import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDb } from "@/lib/db";
import { getPublicOrder } from "./publicOrders";
import type { PublicOrder } from "@/lib/db";
import type { GarmentMeasurements, OrderLineItem } from "@/types";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

const measurements: GarmentMeasurements = {
  type: "generic",
  bust: "34",
  waist: "28",
  hip: "36",
  length: "40",
  shoulder: "14",
  sleeve: "20",
  neckDepth: "6",
  armRound: "15",
};

const lineItems: OrderLineItem[] = [{ particulars: "Blouse", qty: 1, amount: 1000 }];

const publicOrder: PublicOrder = {
  id: "SDS-001",
  customer: "Priya",
  phone: "999",
  dress: "Blouse",
  material: "Silk",
  status: "new",
  amount: 1000,
  advance: 300,
  due: "2026-07-10",
  measurements,
  lineItems,
  notes: "",
  sketchDataUrl: null,
  referenceImageUrl: null,
  createdAt: "2026-06-01T00:00:00.000Z",
};

describe("getPublicOrder", () => {
  const findByPublicToken = vi.fn();

  beforeEach(() => {
    findByPublicToken.mockReset();
    vi.mocked(getDb).mockReturnValue({
      staff: {},
      orders: { findByPublicToken },
    } as never);
  });

  it("looks up the order by its public token without any auth check", async () => {
    findByPublicToken.mockResolvedValue(publicOrder);
    const result = await getPublicOrder("tok-abc123");
    expect(findByPublicToken).toHaveBeenCalledWith("tok-abc123");
    expect(result).toEqual(publicOrder);
  });

  it("returns null for an unknown token", async () => {
    findByPublicToken.mockResolvedValue(null);
    expect(await getPublicOrder("missing")).toBeNull();
  });
});
