import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth";

/**
 * Requirement #10: every admin API route AND every /admin page is protected
 * here via JWT httpOnly cookie check (single consistent gate). Individual
 * route handlers also call requireAdminFromRequest() as defense-in-depth,
 * but middleware is the primary enforcement point per the matcher below.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isLoginPage = pathname === "/admin/login";
  const isLoginApi = pathname === "/api/admin/login";

  if (isLoginPage || isLoginApi) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const payload = token ? verifyAdminToken(token) : null;

  if (!payload) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
