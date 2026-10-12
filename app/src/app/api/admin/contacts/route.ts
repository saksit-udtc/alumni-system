import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { getContactSettings, setContactSettings } from "@/lib/settings";
import { logAdminAction } from "@/lib/auditLog";

// ผู้ประสานงาน/ช่องทางติดต่อที่พิมพ์ท้าย PDF หลักฐานการชำระเงิน — แก้ได้เฉพาะ SUPER_ADMIN
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (!admin) return response;
  return NextResponse.json(await getContactSettings());
}

export async function PUT(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (!admin) return response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("invalid body");

  const saved = await setContactSettings(body);
  await logAdminAction({
    adminId: admin.adminId,
    action: "SYSTEM_SETTINGS_UPDATE",
    detail: `ผู้ติดต่อจอง ${saved.bookingContacts.length} คน · ผู้ประสานงาน ${saved.coordinators.length} คน`,
  });
  return NextResponse.json(saved);
}
