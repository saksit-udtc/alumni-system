import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { hashPassword } from "@/lib/auth";
import { logAdminAction } from "@/lib/auditLog";

const ROLES = ["SUPER_ADMIN", "CHECKIN_STAFF", "MERCH_STAFF", "FINANCE_STAFF"] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const target = await prisma.adminUser.findUnique({ where: { id: params.id } });
  if (!target) {
    return jsonError("ไม่พบผู้ใช้นี้", 404);
  }

  const body = await req.json().catch(() => null);
  const data: { role?: (typeof ROLES)[number]; isActive?: boolean; passwordHash?: string } = {};
  const detailParts: string[] = [];

  if (body?.role !== undefined) {
    if (!ROLES.includes(body.role)) return jsonError("บทบาทไม่ถูกต้อง");
    if (target.id === admin!.adminId && body.role !== "SUPER_ADMIN") {
      return jsonError("ไม่สามารถเปลี่ยนบทบาทของตัวเองออกจาก SUPER_ADMIN ได้");
    }
    data.role = body.role;
    detailParts.push(`role=${body.role}`);
  }

  if (body?.isActive !== undefined) {
    if (target.id === admin!.adminId && body.isActive === false) {
      return jsonError("ไม่สามารถระงับบัญชีของตัวเองได้");
    }
    data.isActive = !!body.isActive;
    detailParts.push(body.isActive ? "เปิดใช้งาน" : "ระงับการใช้งาน");
  }

  if (body?.password !== undefined) {
    if (typeof body.password !== "string" || body.password.length < 8) {
      return jsonError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    }
    data.passwordHash = await hashPassword(body.password);
    detailParts.push("รีเซ็ตรหัสผ่าน");
  }

  if (Object.keys(data).length === 0) {
    return jsonError("ไม่มีข้อมูลที่จะแก้ไข");
  }

  const user = await prisma.adminUser.update({
    where: { id: params.id },
    data,
    select: { id: true, username: true, role: true, isActive: true, createdAt: true },
  });

  await logAdminAction({
    adminId: admin!.adminId,
    action: "ADMIN_USER_UPDATE",
    targetType: "AdminUser",
    targetId: user.id,
    detail: `username=${user.username} ${detailParts.join(", ")}`,
  });

  return NextResponse.json({ user });
}
