import { MAX_ORDER_PIECES, type OrderPiece } from "@/types";

// Splitting an order into several garments, on the way in.
//
// Lives here rather than in the "use server" actions module for two reasons:
// every export of a Server Action file has to be an async action, and the
// wizard needs the draft type on the client.

// What the wizard sends per garment: a name and a date. Ids and delivery
// state are assigned server-side — a client has no business minting the
// identifier a payment will later point at.
export interface OrderPieceDraft {
  label: string;
  due: string;
}

// Returns null — "this order is a single garment", the shape every order had
// before pieces existed — for anything that isn't genuinely split, so a
// one-piece order is written exactly as it always was.
export function buildPieces(
  drafts: OrderPieceDraft[] | undefined,
  orderDue: string
): OrderPiece[] | null {
  if (!drafts || drafts.length <= 1) return null;
  if (drafts.length > MAX_ORDER_PIECES) {
    throw new Error(`An order can hold at most ${MAX_ORDER_PIECES} pieces.`);
  }
  return drafts.map((draft, i) => ({
    id: `p${i + 1}`,
    label: draft.label.trim() || `Piece ${i + 1}`,
    // A piece with no date of its own follows the order's delivery date.
    due: draft.due || orderDue,
    status: "pending" as const,
    deliveredAt: null,
  }));
}

// Changing how many garments an EXISTING order is for — the customer who
// ordered one blouse and comes back wanting three, or the admin who typed
// the wrong number.
//
// Returns the new pieces array, or null when the order goes back to being a
// single garment. Two things are protected:
//
//   * A delivered piece is never removed. It is with the customer and a
//     payment may point at it; it is history, not a plan.
//   * An order can never be *completed* by editing. Shrinking to exactly the
//     number already handed over would leave every piece delivered while the
//     order sat at "partly delivered", with its balance uncollected — so the
//     last garment has to go out through deliverPiece, which takes the money.
//
// Ids are never reused: a new garment always gets a number above the highest
// this order has ever issued, so an old payment can't be re-pointed at a new
// piece by accident.
export function reconcilePieces(
  current: OrderPiece[] | null,
  count: number,
  labelPrefix: string,
  orderDue: string
): OrderPiece[] | null {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("Enter a valid number of pieces.");
  }
  if (count > MAX_ORDER_PIECES) {
    throw new Error(`An order can hold at most ${MAX_ORDER_PIECES} pieces.`);
  }

  const existing = current ?? [];
  const deliveredCount = existing.filter((p) => p.status === "delivered").length;

  if (deliveredCount > 0 && count <= deliveredCount) {
    throw new Error(
      count < deliveredCount
        ? `${deliveredCount} piece${deliveredCount > 1 ? "s have" : " has"} already been handed over — the count can't go below that.`
        : "Hand the last piece over instead — that's when the balance is collected."
    );
  }

  if (count === 1) return null; // back to a single garment

  if (count <= existing.length) {
    // Shrink from the end, skipping over anything already handed over.
    const kept = [...existing];
    while (kept.length > count) {
      const removable = kept.map((p, i) => ({ p, i })).filter(({ p }) => p.status === "pending").pop();
      if (!removable) throw new Error("Only pieces still in the shop can be removed.");
      kept.splice(removable.i, 1);
    }
    return kept;
  }

  // Grow. `p3` -> 3, so the next id is always above every number this order
  // has used, including ones since removed.
  const highest = existing.reduce((max, p) => {
    const n = parseInt(p.id.replace(/^p/, ""), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  const added = Array.from({ length: count - existing.length }, (_, i) => {
    const n = highest + i + 1;
    return {
      id: `p${n}`,
      label: `${labelPrefix} ${n}`,
      due: orderDue,
      status: "pending" as const,
      deliveredAt: null,
    };
  });

  // An order that was a single garment has no piece for the garment it
  // already represents — it becomes the first of the new set.
  if (existing.length === 0) {
    return [
      { id: "p1", label: `${labelPrefix} 1`, due: orderDue, status: "pending" as const, deliveredAt: null },
      ...added.slice(0, count - 1).map((p, i) => ({
        ...p,
        id: `p${i + 2}`,
        label: `${labelPrefix} ${i + 2}`,
      })),
    ];
  }

  return [...existing, ...added];
}
