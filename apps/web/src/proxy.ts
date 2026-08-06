import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "./lib/server-session";

const publicPaths = new Set(["/login", "/admin/login", "/privacy", "/terms"]);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (publicPaths.has(pathname)) return NextResponse.next();

  const authenticated = await hasValidSession(request.headers.get("cookie"));
  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/v1|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
