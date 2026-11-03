import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import {
  getPosPromptPayId,
  setPosPromptPayId,
  getMerchShippingFee,
  setMerchShippingFee,
  getMerchPickupEnabled,
  setMerchPickupEnabled,
  getSenderAddress,
  setSenderAddress,
} from "@/lib/settings";
import { validateThaiAddress } from "@/lib/thaiAddress";
import { validateThaiPhone, cleanPhoneForStorage } from "@/lib/formValidation";
import { isValidPromptPayTarget } from "@/lib/promptpay";
import { logAdminAction } from "@/lib/auditLog";

// ตั้งค่าระบบส่วนกลาง — แก้ได้เฉพาะผู้ดูแลระบบสูงสุด (SUPER_ADMIN)
// (requireAdmin: ส่ง ["SUPER_ADMIN"] = มีแต่ super เท่านั้นที่ผ่าน)
// รวม 2 ค่า: บัญชีพร้อมเพย์รับเงิน (ใช้ทั้งจองออนไลน์/ของที่ระลึก/POS) และค่าจัดส่ง
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (!admin) return response;

  const [promptPayId, shippingFee, pickupEnabled, sender] = await Promise.all([
    getPosPromptPayId(),
    getMerchShippingFee(),
    getMerchPickupEnabled(),
    getSenderAddress(),
  ]);
  return NextResponse.json({ promptPayId, shippingFee, pickupEnabled, sender });
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

  const pickupEnabled = body.pickupEnabled === true;

  // ที่อยู่ผู้ส่ง: เว้นว่างทั้งหมดได้ (ยังไม่ตั้งค่า) แต่ถ้ากรอกอะไรแล้วต้องครบและถูกต้อง
  const rawSender = body.sender && typeof body.sender === "object" ? body.sender : {};
  const sender = {
    name: String(rawSender.name ?? "").trim(),
    phone: String(rawSender.phone ?? "").trim(),
    line: String(rawSender.line ?? "").trim(),
    subdistrict: String(rawSender.subdistrict ?? "").trim(),
    district: String(rawSender.district ?? "").trim(),
    province: String(rawSender.province ?? "").trim(),
    postcode: String(rawSender.postcode ?? "").trim(),
  };
  const senderTouched = [sender.phone, sender.line, sender.subdistrict, sender.district, sender.province, sender.postcode].some(Boolean);
  if (senderTouched) {
    if (!sender.name) return jsonError("กรุณากรอกชื่อผู้ส่ง");
    const phoneErr = validateThaiPhone(sender.phone);
    if (phoneErr) return jsonError(`เบอร์โทรผู้ส่ง: ${phoneErr}`);
    const addrErr = Object.values(validateThaiAddress(sender))[0];
    if (addrErr) return jsonError(`ที่อยู่ผู้ส่ง: ${addrErr}`);
    sender.phone = cleanPhoneForStorage(sender.phone);
  }

  const [, , , savedSender] = await Promise.all([
    setPosPromptPayId(promptPayId),
    setMerchShippingFee(shippingFee),
    setMerchPickupEnabled(pickupEnabled),
    setSenderAddress(sender),
  ]);

  await logAdminAction({
    adminId: admin.adminId,
    action: "SYSTEM_SETTINGS_UPDATE",
    detail: `พร้อมเพย์: ${promptPayId || "(ว่าง)"} · ค่าจัดส่ง: ${shippingFee} บาท · รับสินค้าที่วิทยาลัย: ${pickupEnabled ? "เปิด" : "ปิด"} · ที่อยู่ผู้ส่ง: ${senderTouched ? `${sender.province} ${sender.postcode}` : "(ว่าง)"}`,
  });

  return NextResponse.json({ promptPayId, shippingFee, pickupEnabled, sender: savedSender });
}
