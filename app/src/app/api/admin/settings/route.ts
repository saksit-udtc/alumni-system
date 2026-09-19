import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import {
  getPosPromptPayId,
  setPosPromptPayId,
  getMerchShippingFee,
  setMerchShippingFee,
} from "@/lib/settings";
import { isValidPromptPayTarget } from "@/lib/promptpay";
import { logAdminAction } from "@/lib/auditLog";

// ตั้งค่าระบบส่วนกลาง — แก้ได้เฉพาะผู้ดูแลระบบสูงสุด (SUPER_ADMIN)
// (requireAdmin: ส่ง ["SUPER_ADMIN"] = มีแต่ super เท่านั้นที่ผ่าน)
// รวม 2 ค่า: บัญชีพร้อมเพย์รับเงิน (ใช้ทั้งจองออนไลน์/ของที่ระลึก/POS) และค่าจัดส่ง
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (!admin) return response;

  const [promptPayId, shippingFee] = await Promise.all([
    getPosPromptPayId(),
    getMerchShippingFee(),
  ]);
  return NextResponse.json({ promptPayId, shippingFee });
}

export async function PUT(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (!admin) return response;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("invalid body");

  // พร้อมเพย์: ว่างได้ (= ล้างค่า, ระบบจะไม่โชว์ QR จนกว่าจะตั้งใหม่)
  // ถ้ามีค่า ต้องเป็นรูปแบบที่ generatePromptPayPayload encode ได้จริง
  const promptPayId =
    typeof body.promptPayId === "string" ? body.promptPayId.trim() : "";
  if (promptPayId && !isValidPromptPayTarget(promptPayId)) {
    return jsonError(
      "รูปแบบเลขพร้อมเพย์ไม่ถูกต้อง (ต้องเป็นเบอร์โทร 10 หลัก หรือเลขบัตร/นิติบุคคล 13 หลัก)",
    );
  }

  // ค่าจัดส่ง: ตัวเลข >= 0
  const shippingFee = Number(body.shippingFee);
  if (!Number.isFinite(shippingFee) || shippingFee < 0) {
    return jsonError("กรุณากรอกค่าจัดส่งเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0");
  }

  await Promise.all([
    setPosPromptPayId(promptPayId),
    setMerchShippingFee(shippingFee),
  ]);

  await logAdminAction({
    adminId: admin.adminId,
    action: "SYSTEM_SETTINGS_UPDATE",
    detail: `พร้อมเพย์: ${promptPayId || "(ว่าง)"} · ค่าจัดส่ง: ${shippingFee} บาท`,
  });

  return NextResponse.json({ promptPayId, shippingFee });
}
