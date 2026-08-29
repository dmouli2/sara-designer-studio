import { describe, it, expect } from "vitest";
import { buildPieces, reconcilePieces } from "./pieces";
import { MAX_ORDER_PIECES, type MaterialSource, type OrderPiece } from "@/types";

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

function piece(over: Partial<OrderPiece> = {}): OrderPiece {
  return { id: "p1", label: "Blouse 1", due: "2026-09-01", status: "pending", deliveredAt: null, ...over };
}

const THREE: OrderPiece[] = [
  piece(),
  piece({ id: "p2", label: "Blouse 2" }),
  piece({ id: "p3", label: "Blouse 3" }),
];

describe("reconcilePieces", () => {
  it("splits an order that was a single garment", () => {
    expect(reconcilePieces(null, 3, "Blouse", "2026-09-01")).toEqual([
      { id: "p1", label: "Blouse 1", due: "2026-09-01", status: "pending", deliveredAt: null },
      { id: "p2", label: "Blouse 2", due: "2026-09-01", status: "pending", deliveredAt: null },
      { id: "p3", label: "Blouse 3", due: "2026-09-01", status: "pending", deliveredAt: null },
    ]);
  });

  it("puts a split order back to a single garment", () => {
    expect(reconcilePieces(THREE, 1, "Blouse", "2026-09-01")).toBeNull();
    expect(reconcilePieces(null, 1, "Blouse", "2026-09-01")).toBeNull();
  });

  it("adds garments without disturbing the existing ones", () => {
    const result = reconcilePieces(THREE, 5, "Blouse", "2026-10-01")!;
    expect(result.slice(0, 3)).toEqual(THREE);
    expect(result.slice(3)).toEqual([
      { id: "p4", label: "Blouse 4", due: "2026-10-01", status: "pending", deliveredAt: null },
      { id: "p5", label: "Blouse 5", due: "2026-10-01", status: "pending", deliveredAt: null },
    ]);
  });

  it("removes pending garments from the end", () => {
    expect(reconcilePieces(THREE, 2, "Blouse", "2026-09-01")).toEqual(THREE.slice(0, 2));
  });

  // A delivered garment is with the customer and a payment may point at it.
  it("never removes a garment already handed over", () => {
    const withDelivered = [
      THREE[0],
      piece({ id: "p2", label: "Blouse 2", status: "delivered", deliveredAt: "x" }),
      THREE[2],
    ];
    const result = reconcilePieces(withDelivered, 2, "Blouse", "2026-09-01")!;
    expect(result.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(result[1].status).toBe("delivered");
  });

  it("refuses to go below what has already gone out", () => {
    const twoDelivered = [
      piece({ id: "p1", status: "delivered", deliveredAt: "x" }),
      piece({ id: "p2", status: "delivered", deliveredAt: "x" }),
      THREE[2],
    ];
    expect(() => reconcilePieces(twoDelivered, 1, "Blouse", "2026-09-01")).toThrow("already been handed over");
  });

  // Shrinking to exactly the delivered count would leave every garment gone
  // while the order still owed money and sat at "partly delivered".
  it("refuses to complete an order by editing", () => {
    const oneDelivered = [piece({ id: "p1", status: "delivered", deliveredAt: "x" }), THREE[1]];
    expect(() => reconcilePieces(oneDelivered, 1, "Blouse", "2026-09-01")).toThrow(
      "Hand the last piece over instead"
    );
  });

  // A payment points at a piece id; handing p3's id to a different garment
  // later would silently re-attribute that money.
  it("never reuses the id of a removed garment", () => {
    const shrunk = reconcilePieces(THREE, 2, "Blouse", "2026-09-01");
    const regrown = reconcilePieces(shrunk, 3, "Blouse", "2026-09-01")!;
    expect(regrown[2].id).toBe("p3");

    // …and after the id counter has actually moved past it.
    const grown = reconcilePieces(THREE, 4, "Blouse", "2026-09-01");
    const shrunkAgain = reconcilePieces(grown, 3, "Blouse", "2026-09-01");
    expect(reconcilePieces(shrunkAgain, 4, "Blouse", "2026-09-01")![3].id).toBe("p4");
  });

  it("rejects a nonsense or oversized count", () => {
    expect(() => reconcilePieces(THREE, 0, "Blouse", "2026-09-01")).toThrow("valid number");
    expect(() => reconcilePieces(THREE, 2.5, "Blouse", "2026-09-01")).toThrow("valid number");
    expect(() => reconcilePieces(THREE, MAX_ORDER_PIECES + 1, "Blouse", "2026-09-01")).toThrow("at most");
  });

  it("leaves an unchanged count alone", () => {
    expect(reconcilePieces(THREE, 3, "Blouse", "2026-09-01")).toEqual(THREE);
  });
});

describe("material source on pieces", () => {
  it("buildPieces omits the source when the garments all match", () => {
    const built = buildPieces(
      [{ label: "Blouse 1", due: "2026-09-01" }, { label: "Blouse 2", due: "2026-09-01" }],
      "2026-09-01"
    );
    expect(built!.every((p) => !("materialSource" in p))).toBe(true);
  });

  it("buildPieces carries the source through when they differ", () => {
    const built = buildPieces(
      [
        { label: "Blouse 1", due: "2026-09-01", materialSource: "shop" },
        { label: "Blouse 2", due: "2026-09-01", materialSource: "customer" },
      ],
      "2026-09-01"
    );
    expect(built!.map((p) => p.materialSource)).toEqual(["shop", "customer"]);
  });

  it("reconcilePieces applies sources to the settled list", () => {
    const sources: MaterialSource[] = ["shop", "customer", "shop"];
    const result = reconcilePieces(null, 3, "Blouse", "2026-09-01", sources)!;
    expect(result.map((p) => p.materialSource)).toEqual(sources);
  });

  // An undefined entry means "leave this one as it is", so a caller can never
  // blank a stored source by sending a short array.
  it("reconcilePieces leaves a source alone for an undefined entry", () => {
    const current: OrderPiece[] = [
      { id: "p1", label: "Blouse 1", due: "2026-09-01", status: "pending", deliveredAt: null, materialSource: "shop" },
      { id: "p2", label: "Blouse 2", due: "2026-09-01", status: "pending", deliveredAt: null, materialSource: "customer" },
    ];
    const result = reconcilePieces(current, 2, "Blouse", "2026-09-01", [undefined, "shop"])!;
    expect(result.map((p) => p.materialSource)).toEqual(["shop", "shop"]);
  });

  it("reconcilePieces sets sources on garments it just added", () => {
    const current: OrderPiece[] = [
      { id: "p1", label: "Blouse 1", due: "2026-09-01", status: "pending", deliveredAt: null },
    ];
    const result = reconcilePieces(current, 2, "Blouse", "2026-09-01", ["customer", "shop"])!;
    expect(result.map((p) => p.materialSource)).toEqual(["customer", "shop"]);
  });
});
