import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { signAdminToken, ADMIN_COOKIE_NAME, AdminRole } from "@/lib/auth";
import { logAdminAction } from "@/lib/auditLog";

// "มุมมองทดสอบ (View as)" สำหรับ debug — ให้ผู้ดูแลระบบสูงสุด (SUPER_ADMIN) สลับ
// ไปใช้งาน "จริง" ในฐานะบทบาทอื่นได้ (token ถูกออกใหม่เป็นบทบาทนั้น API จึงกันสิทธิ์
// เหมือน staff จริง) — เลือก SUPER_ADMIN = กลับเป็นตัวเอง
// ความปลอดภัย: เฉพาะ "ตัวจริงเป็น super" เท่านั้นที่เรียกได้ และทำได้แค่ "ลด" สิทธิ์
// ตัวเองลงชั่วคราว ไม่มีทางยกระดับสิทธิ์ให้ใคร (staff เรียก = 403)
const ROLES: AdminRole[] = [
  "SUPER_ADMIN",
  "RESERVATION_STAFF",
  "FINANCE_STAFF",
  "MERCH_STAFF",
  "CHECKIN_STAFF",
];

export async function POST(req: NextRequest) {
  const { admin, response } = requireAdmin(req);
  if (!admin) return response;

  // realRole = บทบาทจริง (ถ้ากำลัง impersonate อยู่ actualRole จะบอกว่าจริง ๆ คือ super)
  const realRole = admin.actualRole ?? admin.role;
  if (realRole !== "SUPER_ADMIN") {
    return jsonError("เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น", 403);
  }

  const body = await req.json().catch(() => null);
  const role = body?.role as AdminRole;
  if (!ROLES.includes(role)) return jsonError("บทบาทไม่ถูกต้อง");

  const isReset = role === "SUPER_ADMIN"; // กลับเป็นตัวเอง
  const token = signAdminToken(
    isReset
      ? { adminId: admin.adminId, username: admin.username, role: "SUPER_ADMIN" }
      : { adminId: admin.adminId, username: admin.username, role, actualRole: "SUPER_ADMIN" },
  );

  const res = NextResponse.json({
    ok: true,
    role,
    actualRole: isReset ? null : "SUPER_ADMIN",
  });
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  await logAdminAction({
    adminId: admin.adminId,
    action: isReset ? "IMPERSONATE_EXIT" : "IMPERSONATE_ROLE",
    detail: isReset ? "กลับเป็นผู้ดูแลระบบสูงสุด" : `ทดสอบในฐานะ ${role}`,
  });

  return res;
}
