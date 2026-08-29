import { describe, it, expect } from "vitest";
import { buildPieces } from "./pieces";
import { MAX_ORDER_PIECES } from "@/types";

describe("buildPieces", () => {
  // The whole backwards-compatibility guarantee rests on this: anything that
  // isn't genuinely split is stored as null, which is the shape every order
  // had before pieces existed.
  it("returns null for an unsplit order", () => {
    expect(buildPieces(undefined, "2026-09-01")).toBeNull();
    expect(buildPieces([], "2026-09-01")).toBeNull();
    expect(buildPieces([{ label: "Blouse 1", due: "2026-09-01" }], "2026-09-01")).toBeNull();
  });

  it("assigns stable ids and keeps the given labels and dates", () => {
    expect(
      buildPieces(
        [
          { label: "Red silk", due: "2026-09-01" },
          { label: "Green cotton", due: "2026-09-15" },
        ],
        "2026-09-20"
      )
    ).toEqual([
      { id: "p1", label: "Red silk", due: "2026-09-01", status: "pending", deliveredAt: null },
      { id: "p2", label: "Green cotton", due: "2026-09-15", status: "pending", deliveredAt: null },
    ]);
  });

  it("falls back to the order's delivery date for a piece with no date", () => {
    const pieces = buildPieces(
      [
        { label: "Blouse 1", due: "" },
        { label: "Blouse 2", due: "2026-09-15" },
      ],
      "2026-09-20"
    );
    expect(pieces?.[0].due).toBe("2026-09-20");
    expect(pieces?.[1].due).toBe("2026-09-15");
  });

  it("names an unnamed piece by its position", () => {
    const pieces = buildPieces(
      [
        { label: "   ", due: "2026-09-01" },
        { label: "Blouse 2", due: "2026-09-01" },
      ],
      "2026-09-01"
    );
    expect(pieces?.[0].label).toBe("Piece 1");
  });

  it("refuses more pieces than an order may hold", () => {
    const drafts = Array.from({ length: MAX_ORDER_PIECES + 1 }, (_, i) => ({
      label: `Blouse ${i + 1}`,
      due: "2026-09-01",
    }));
    expect(() => buildPieces(drafts, "2026-09-01")).toThrow("at most");
  });

  it("accepts exactly the maximum", () => {
    const drafts = Array.from({ length: MAX_ORDER_PIECES }, (_, i) => ({
      label: `Blouse ${i + 1}`,
      due: "2026-09-01",
    }));
    expect(buildPieces(drafts, "2026-09-01")).toHaveLength(MAX_ORDER_PIECES);
  });
});
