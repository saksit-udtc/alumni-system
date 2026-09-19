import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { getSiteTheme, setSiteTheme, isSiteTheme } from "@/lib/settings";
import { logAdminAction } from "@/lib/auditLog";

// ธีมสีของเว็บ — เปลี่ยนได้เฉพาะผู้ดูแลระบบสูงสุด (SUPER_ADMIN)
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (!admin) return response;
  return NextResponse.json({ theme: await getSiteTheme() });
}

export async function PUT(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (!admin) return response;

  const body = await req.json().catch(() => null);
  if (!body || !isSiteTheme(body.theme)) return jsonError("ธีมไม่ถูกต้อง");

  await setSiteTheme(body.theme);
  await logAdminAction({
    adminId: admin.adminId,
    action: "SITE_THEME_UPDATE",
    detail: `ธีม: ${body.theme}`,
  });
  return NextResponse.json({ theme: body.theme });
}
