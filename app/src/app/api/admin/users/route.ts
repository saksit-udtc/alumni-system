import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { hashPassword } from "@/lib/auth";
import { logAdminAction } from "@/lib/auditLog";

const ROLES = ["SUPER_ADMIN", "CHECKIN_STAFF", "MERCH_STAFF"] as const;

export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const users = await prisma.adminUser.findMany({
    select: { id: true, username: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const username = body?.username?.trim();
  const password = body?.password;
  const role = body?.role;

  if (!username || !password) {
    return jsonError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
  }
  if (password.length < 8) {
    return jsonError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  }
  if (!ROLES.includes(role)) {
    return jsonError("บทบาทไม่ถูกต้อง");
  }

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    return jsonError("มีชื่อผู้ใช้นี้อยู่แล้ว");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.adminUser.create({
    data: { username, passwordHash, role },
    select: { id: true, username: true, role: true, isActive: true, createdAt: true },
  });

  await logAdminAction({
    adminId: admin!.adminId,
    action: "ADMIN_USER_CREATE",
    targetType: "AdminUser",
    targetId: user.id,
    detail: `username=${user.username} role=${user.role}`,
  });

  return NextResponse.json({ user });
}
