import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { uploadObject, deleteObject, PAYMENT_SLIPS_BUCKET } from "@/lib/minio";
import { cleanPhoneForStorage, isValidEmailFormat, normalizeEmail, validateThaiPhone } from "@/lib/formValidation";
import {
  DISTINGUISHED_ALUMNI_DEFAULT_AMOUNT,
  DISTINGUISHED_ALUMNI_OPTIONS,
  SPONSOR_MAX_AMOUNT,
  SPONSOR_MIN_AMOUNT,
  SupportType,
} from "@/lib/supportConfig";
import { generateSupportCode } from "@/lib/supportRegistration";
import { sendSupportRegistrationReceivedEmail } from "@/lib/mailer";
import { verifySupportRegistrationSlipAsync } from "@/lib/easyslip";

// Public: ลงทะเบียนศิษย์เก่าดีเด่น / ผู้สนับสนุนงาน พร้อมแนบสลิปในคำขอเดียว
// (multipart/form-data) — รูปแบบเดียวกับ /api/merch/orders
const MAX_SLIP_BYTES = 10 * 1024 * 1024;
const ALLOWED_SLIP_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid form data" }, { status: 400 });

  const type = String(form.get("type") || "") as SupportType;
  if (type !== "distinguished_alumni" && type !== "sponsor") {
    return NextResponse.json({ error: "ประเภทการลงทะเบียนไม่ถูกต้อง" }, { status: 400 });
  }

  const name = String(form.get("name") || "").trim();
  const detail = String(form.get("detail") || "").trim();
  const phoneRaw = String(form.get("phone") || "");
  const email = normalizeEmail(String(form.get("email") || ""));
  const file = form.get("file") as File | null;

  if (!name || name.length < 2) return NextResponse.json({ error: "กรุณากรอกชื่อ-นามสกุล" }, { status: 400 });
  if (type === "distinguished_alumni" && !detail) {
    return NextResponse.json({ error: "กรุณากรอกรุ่น/ปีที่จบ และแผนกวิชา" }, { status: 400 });
  }
  const phoneErr = validateThaiPhone(phoneRaw);
  if (phoneErr) return NextResponse.json({ error: phoneErr }, { status: 400 });
  if (!email || !isValidEmailFormat(email)) {
    return NextResponse.json({ error: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });
  }

  // ยอดเงิน: ศิษย์เก่าดีเด่นเลือก 5,000 / 10,000 | ผู้สนับสนุนกำหนดเอง (ตรวจช่วงฝั่ง server)
  let amount: number = DISTINGUISHED_ALUMNI_DEFAULT_AMOUNT;
  if (type === "distinguished_alumni") {
    const raw = form.get("amount");
    if (raw !== null && String(raw) !== "") {
      amount = Number(raw);
      if (!DISTINGUISHED_ALUMNI_OPTIONS.some((o) => o.amount === amount)) {
        return NextResponse.json({ error: "กรุณาเลือกยอดลงทะเบียนศิษย์เก่าดีเด่น 5,000 หรือ 10,000 บาท" }, { status: 400 });
      }
    }
  } else {
    amount = Math.round(Number(form.get("amount")) * 100) / 100;
    if (!Number.isFinite(amount) || amount < SPONSOR_MIN_AMOUNT || amount > SPONSOR_MAX_AMOUNT) {
      return NextResponse.json(
        { error: `กรุณาระบุวงเงินระหว่าง ${SPONSOR_MIN_AMOUNT.toLocaleString("th-TH")} - ${SPONSOR_MAX_AMOUNT.toLocaleString("th-TH")} บาท` },
        { status: 400 }
      );
    }
  }

  if (!file || typeof file === "string" || file.size === 0) {
    return NextResponse.json({ error: "กรุณาแนบไฟล์สลิปโอนเงิน" }, { status: 400 });
  }
  if (file.size > MAX_SLIP_BYTES) {
    return NextResponse.json({ error: "ไฟล์สลิปต้องมีขนาดไม่เกิน 10MB" }, { status: 400 });
  }
  if (file.type && !ALLOWED_SLIP_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "รองรับเฉพาะไฟล์รูปภาพหรือ PDF" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
  const slipFileKey = `support-${crypto.randomUUID()}.${ext}`;
  await uploadObject(PAYMENT_SLIPS_BUCKET, slipFileKey, buffer, file.type || "image/jpeg");

  try {
    // สุ่มรหัสซ้ำได้น้อยมาก แต่ลองใหม่สูงสุด 5 ครั้งถ้าชน unique
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const reg = await prisma.supportRegistration.create({
          data: {
            code: generateSupportCode(type),
            type,
            name,
            detail: detail || null,
            phone: cleanPhoneForStorage(phoneRaw),
            email,
            amount,
            slipFileKey,
          },
        });
        // อีเมลแจ้งว่าได้รับสลิป (fail-soft — ไม่ throw)
        await sendSupportRegistrationReceivedEmail({
          to: reg.email,
          name: reg.name,
          type: reg.type,
          code: reg.code,
          amount: Number(reg.amount),
        });

        // EasySlip ตรวจสลิปเบื้องหลัง (ผลเป็นคำแนะนำ — แอดมินยังต้องอนุมัติเอง)
        void verifySupportRegistrationSlipAsync(reg.id, slipFileKey, Number(reg.amount)).catch((err) =>
          console.error("[POST /api/support-registrations] easyslip verify failed:", err)
        );

        return NextResponse.json({ ok: true, code: reg.code, amount: Number(reg.amount) });
      } catch (err: any) {
        if (err?.code === "P2002" && attempt < 4) continue;
        throw err;
      }
    }
    throw new Error("could not generate unique code");
  } catch (err) {
    await deleteObject(PAYMENT_SLIPS_BUCKET, slipFileKey).catch(() => {});
    console.error("[POST /api/support-registrations]", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
