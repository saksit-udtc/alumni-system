import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "./auth";

/** Used inside every /api/admin/** route handler as defense-in-depth (requirement #10). */
export function requireAdmin(req: NextRequest) {
  const admin = requireAdminFromRequest(req);
  if (!admin) {
    return { admin: null, response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  }
  return { admin, response: null };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
