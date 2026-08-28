import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest, AdminTokenPayload } from "./auth";

type AdminRole = AdminTokenPayload["role"];

/**
 * Used inside every /api/admin/** route handler as defense-in-depth (requirement #10).
 * This is also the ONLY place role access is actually enforced right now — middleware.ts
 * has a role gate too, but do not rely on it alone; always pass allowedRoles here for any
 * route that isn't meant for every logged-in admin.
 *
 * @param allowedRoles - if provided, the admin's role must be in this list (SUPER_ADMIN
 *   is always allowed regardless of this list). If omitted, any authenticated admin passes.
 */
export function requireAdmin(req: NextRequest, allowedRoles?: AdminRole[]) {
  const admin = requireAdminFromRequest(req);
  if (!admin) {
    return { admin: null, response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  }
  if (allowedRoles && admin.role !== "SUPER_ADMIN" && !allowedRoles.includes(admin.role)) {
    return { admin: null, response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }
  return { admin, response: null };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
