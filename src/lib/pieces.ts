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
