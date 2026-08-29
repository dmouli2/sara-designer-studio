// Kill switches for features that must be easy to turn off in one place.
//
// FEATURE_SCAN_ORDERS gates the whole scan-to-draft-order flow: flipping it
// to false hides the scan entry on the new-order screen, redirects
// /admin/orders/scan and /admin/drafts* back to /admin/orders, and makes
// every server action in src/app/actions/drafts.ts refuse. Real order
// placement is untouched either way — drafts only ever become orders through
// the normal createOrder path.
export const FEATURE_SCAN_ORDERS = true;

// Guard used by the draft server actions; a helper (rather than an inline
// `if`) so the error message stays identical everywhere.
export function assertScanFeatureEnabled(): void {
  if (!FEATURE_SCAN_ORDERS) {
    throw new Error("Order slip scanning is currently disabled.");
  }
}

// FEATURE_MULTI_PIECE gates splitting one order into several garments with
// their own delivery dates (the "three blouses, same measurements" case).
// Turning it off hides the piece stepper in the new-order wizard, so no new
// order can be split.
//
// It deliberately does NOT hide pieces on orders that already have them:
// those garments are real, some may already be with the customer, and hiding
// the only screen that can hand the rest over would strand them. Off means
// "stop creating these", not "pretend they don't exist".
export const FEATURE_MULTI_PIECE = true;

// FEATURE_ALTERATIONS gates the post-delivery alteration flow. Turning it off
// hides the "Came back for alteration" button and every alteration action
// refuses — but, for the same reason as above, an alteration already open
// stays visible and can still be closed out.
export const FEATURE_ALTERATIONS = true;

export function assertAlterationsEnabled(): void {
  if (!FEATURE_ALTERATIONS) {
    throw new Error("Alteration tracking is currently disabled.");
  }
}
