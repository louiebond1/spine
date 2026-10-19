import { NextResponse, type NextRequest } from "next/server";

// First line of defence: no session cookie, no app. Pages go to sign-in and API routes get 401.
// The real check (token hash, expiry, active account, organisation) happens on the server in
// src/server/auth/session.ts for every request, so a forged cookie gets nothing.

const PUBLIC = [/^\/login$/, /^\/signup$/, /^\/invite\/[^/]+$/, /^\/api\/health$/];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();
  if (req.cookies.get("spine_session")?.value) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's own assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
