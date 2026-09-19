import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { getPosPromptPayId, setPosPromptPayId } from "@/lib/settings";
import { isValidPromptPayTarget } from "@/lib/promptpay";
import { logAdminAction } from "@/lib/auditLog";

// Plain GET, no dynamic route segment, reads the DB — force-dynamic (see
// note in ../products/route.ts).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["MERCH_STAFF"]);
  if (!admin) return response;

  const promptPayId = await getPosPromptPayId();
  return NextResponse.json({ promptPayId });
}

export async function PUT(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (!admin) return response;

  const body = await req.json().catch(() => null);
  const promptPayId = typeof body?.promptPayId === "string" ? body.promptPayId.trim() : "";

  // Empty is allowed (clears the setting — POS just won't show a payment
  // QR until one is set again). A non-empty value must be a shape
  // generatePromptPayPayload can actually encode.
  if (promptPayId && !isValidPromptPayTarget(promptPayId)) {
    return jsonError("รูปแบบเลขพร้อมเพย์ไม่ถูกต้อง (ต้องเป็นเบอร์โทร 10 หลัก หรือเลขบัตร/นิติบุคคล 13 หลัก)");
  }

  await setPosPromptPayId(promptPayId);
  await logAdminAction({
    adminId: admin.adminId,
    action: "POS_PROMPTPAY_SETTING_UPDATE",
    detail: promptPayId ? "ตั้งค่าเลขพร้อมเพย์" : "ล้างค่าเลขพร้อมเพย์",
  });

  return NextResponse.json({ promptPayId });
}
