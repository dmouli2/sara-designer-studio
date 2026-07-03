import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE_NAME } from "@/lib/session";
import type { Role } from "@/types";

const PUBLIC_ROUTES = ["/login"];

// Customer order-tracking link (src/app/track/[token]/) — public regardless
// of session state. Kept separate from PUBLIC_ROUTES since, unlike /login,
// a logged-in staff member opening this link should NOT be bounced to their
// role home; the route itself never touches the auth cookie.
function isPublicTrackRoute(pathname: string): boolean {
  return pathname.startsWith("/track/");
}

// Admin lands directly on /admin/orders (not /admin, which is just a
// redirect page) so a PWA launch reaches content in a single hop.
function roleHome(role: Role): string {
  return role === "admin" ? "/admin/orders" : `/${role}/queue`;
}

// Optimistic only: decrypts the cookie for a fast redirect, never hits the
// database. Real authorization always happens in the DAL (src/lib/dal.ts)
// and Server Actions, which re-check the staff record on every request.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decrypt(token);
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // API route handlers (health ping, cron jobs) do their own auth — a login
  // redirect would just bounce the cron to an HTML page and skip the work.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (!isPublicRoute && !isPublicTrackRoute(pathname) && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // "/" and "/login" both funnel a logged-in user straight to their role
  // home in one hop, instead of bouncing through the static "/" -> "/login"
  // redirect page first.
  if ((isPublicRoute || pathname === "/") && session) {
    return NextResponse.redirect(new URL(roleHome(session.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.png$).*)"],
};
