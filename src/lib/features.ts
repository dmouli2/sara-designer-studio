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
