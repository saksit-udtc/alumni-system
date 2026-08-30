import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
export const ADMIN_COOKIE_NAME = "alumni_admin_token";
const TOKEN_TTL = "12h";

export interface AdminTokenPayload {
  adminId: string;
  username: string;
  role: "SUPER_ADMIN" | "CHECKIN_STAFF" | "MERCH_STAFF" | "FINANCE_STAFF" | "RESERVATION_STAFF";
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
  } catch {
    return null;
  }
}

/**
 * requireAdmin() — used inside route handlers as a defense-in-depth check
 * in addition to middleware.ts, which is the primary gate for /admin/** and
 * /api/admin/**. Returns the decoded payload or null if unauthenticated.
 */
export function requireAdminFromRequest(req: NextRequest): AdminTokenPayload | null {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export function requireAdminFromCookies(): AdminTokenPayload | null {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}
