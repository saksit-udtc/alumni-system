import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth";

/**
 * Requirement #10: every admin API route AND every /admin page is protected
 * here via JWT httpOnly cookie check (single consistent gate). Individual
 * route handlers also call requireAdminFromRequest() as defense-in-depth,
 * but middleware is the primary enforcement point per the matcher below.
 *
 * Role-based access: SUPER_ADMIN can reach everything. CHECKIN_STAFF is
 * restricted to the check-in menu; MERCH_STAFF is restricted to the
 * merch (orders/products) menu. Add new route groups here as new roles
 * are introduced — this is the single place role access is enforced.
 */
const ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
  CHECKIN_STAFF: ["/admin/checkin", "/api/admin/checkin"],
  MERCH_STAFF: ["/admin/merch", "/api/admin/merch"],
};

// Where a non-super-admin role lands instead of the (SUPER_ADMIN-only) dashboard.
const ROLE_HOME: Record<string, string> = {
  CHECKIN_STAFF: "/admin/checkin",
  MERCH_STAFF: "/admin/merch/orders",
};

function isPathAllowedForRole(pathname: string, role: string): boolean {
  if (role === "SUPER_ADMIN") return true;
  // Logout and the "who am I" check are always allowed for any logged-in admin.
  if (pathname === "/api/admin/logout" || pathname === "/api/admin/me") {
    return true;
  }
  const allowedPrefixes = ROLE_ALLOWED_PREFIXES[role];
  if (!allowedPrefixes) return false;
  return allowedPrefixes.some((prefix) => pathname.startsWith(prefix));
}

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

  if (!isPathAllowedForRole(pathname, payload.role)) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const home = ROLE_HOME[payload.role] || "/admin/login";
    return NextResponse.redirect(new URL(home, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
