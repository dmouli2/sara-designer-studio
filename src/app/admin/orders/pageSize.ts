// One page of order history. The server page loads the first page; older
// pages are appended on demand so the list doesn't grow unbounded with years
// of history.
//
// Lives in its own (server-safe) module rather than in OrdersBody: importing
// a value export from a "use client" module into a Server Component hands the
// server a client-reference stub, not the number — which turned the list
// query's range into (0, NaN) and silently returned zero orders.
export const ORDERS_PAGE_SIZE = 200;
