import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE_NAME } from "@/lib/session";
import type { Role } from "@/types";

const PUBLIC_ROUTES = ["/login"];

function roleHome(role: Role): string {
  return role === "admin" ? "/admin" : `/${role}/queue`;
}

// Optimistic only: decrypts the cookie for a fast redirect, never hits the
// database. Real authorization always happens in the DAL (src/lib/dal.ts)
// and Server Actions, which re-check the staff record on every request.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decrypt(token);
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  if (!isPublicRoute && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isPublicRoute && session) {
    return NextResponse.redirect(new URL(roleHome(session.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.png$).*)"],
};
