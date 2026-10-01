import { prisma } from "./prisma";
import { presignedGetUrl, PAYMENT_SLIPS_BUCKET } from "./minio";

/**
 * EasySlip (https://easyslip.com) integration — auto-verifies an uploaded
 * payment slip against the real Thai banking system right after it's
 * uploaded, so an admin sees a "checked against the bank" badge next to the
 * existing "ดูสลิป" link before they decide whether to approve. This is
 * purely advisory (per product decision): a mismatch or a slip EasySlip
 * can't recognize is shown as a red warning, but never blocks the admin's
 * own "อนุมัติ" button — see the calling sites in bookTable/bookPackage/
 * createMerchOrder's API routes.
 *
 * API key comes from EASYSLIP_API_KEY (see docker-compose.yml) — sign up at
 * https://easyslip.com to get one. When it's not configured, every call
 * below resolves to status "SKIPPED" rather than throwing, so the feature is
 * fully optional and never blocks a booking/order.
 */

export type SlipVerifyStatus =
  | "MATCH"
  | "AMOUNT_MISMATCH"
  | "ACCOUNT_MISMATCH"
  | "INVALID_SLIP"
  | "DUPLICATE"
  | "ERROR"
  | "SKIPPED";

export interface SlipVerifyResult {
  status: SlipVerifyStatus;
  message: string;
  transRef?: string;
  actualAmount?: number;
}

interface EasySlipV2Response {
  success: boolean;
  data?: {
    rawSlip: {
      transRef: string;
      date: string;
      amount: { amount: number };
      sender?: { bank?: { name?: string }; account?: { name?: { th?: string; en?: string } } };
      receiver?: { bank?: { name?: string }; account?: { name?: { th?: string; en?: string } } };
    };
    isDuplicate: boolean;
    // มีมาเฉพาะเมื่อส่ง matchAccount: true — null = บัญชีผู้รับในสลิปไม่ตรงกับบัญชีรับเงิน
    // ที่ผูกไว้กับสาขา (API key) นี้ใน EasySlip dashboard ("จัดการบัญชี")
    matchedAccount?: unknown | null;
  };
  error?: { code: string; message: string };
}

const AMOUNT_TOLERANCE_BAHT = 0.01;

/** รายการที่สลิปนี้เป็นของ — ใช้แยก "สลิปซ้ำจริง" ออกจาก "เราเคยตรวจใบนี้เองมาก่อน" */
export type SlipOwner =
  | { kind: "reservation"; id: string } // Reservation.id
  | { kind: "merch"; id: string } // MerchOrder.id
  | { kind: "support"; id: string }; // SupportRegistration.id

/**
 * หาว่าเลขอ้างอิงสลิป (transRef) นี้ถูกใช้กับรายการ "อื่น" ในระบบเราหรือไม่
 * (ข้ามทั้งการจองโต๊ะ / ของที่ระลึก / ลงทะเบียนผู้สนับสนุน) — คืนรหัสรายการนั้น หรือ null
 * รายการที่ถูกปฏิเสธ/หมดอายุแล้วไม่นับ เพื่อให้ลูกค้าอัปโหลดสลิปเดิมกับรายการใหม่ได้
 */
async function findOtherUseOfTransRef(transRef: string, owner: SlipOwner): Promise<string | null> {
  const [resv, merch, support] = await Promise.all([
    prisma.paymentSlip.findFirst({
      where: {
        easyslipTransRef: transRef,
        ...(owner.kind === "reservation" ? { reservationId: { not: owner.id } } : {}),
      },
      select: { reservation: { select: { bookingCode: true, paymentStatus: true } } },
    }),
    prisma.merchPaymentSlip.findFirst({
      where: {
        easyslipTransRef: transRef,
        ...(owner.kind === "merch" ? { orderId: { not: owner.id } } : {}),
      },
      select: { order: { select: { orderCode: true, paymentStatus: true } } },
    }),
    prisma.supportRegistration.findFirst({
      where: {
        easyslipTransRef: transRef,
        ...(owner.kind === "support" ? { id: { not: owner.id } } : {}),
      },
      select: { code: true },
    }),
  ]);
  const dead = (st: unknown) => typeof st === "string" && (st === "rejected" || st === "expired");
  if (resv?.reservation && !dead(resv.reservation.paymentStatus)) return `การจองโต๊ะ ${resv.reservation.bookingCode}`;
  if (merch?.order && !dead(merch.order.paymentStatus)) return `คำสั่งซื้อ ${merch.order.orderCode}`;
  if (support) return `การลงทะเบียน ${support.code}`;
  return null;
}

/**
 * Calls EasySlip's v2 bank-verify endpoint with a (short-lived, presigned)
 * image URL and compares the amount EasySlip read off the slip against what
 * we expect to have been paid. Never throws — every failure path (missing
 * API key, network error, EasySlip error response) resolves to a
 * SlipVerifyResult instead, so a caller can always safely store the result.
 */
export async function verifySlipByUrl(
  imageUrl: string,
  expectedAmount: number,
  owner?: SlipOwner
): Promise<SlipVerifyResult> {
  const apiKey = process.env.EASYSLIP_API_KEY;
  if (!apiKey) {
    return { status: "SKIPPED", message: "ยังไม่ได้ตั้งค่า EasySlip API key" };
  }

  let json: EasySlipV2Response;
  try {
    const res = await fetch("https://api.easyslip.com/v2/verify/bank", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: imageUrl, checkDuplicate: true, matchAccount: true }),
      // EasySlip is an external network call — don't let a hung request
      // block whatever fire-and-forget task called this indefinitely.
      signal: AbortSignal.timeout(30_000),
    });
    json = await res.json();
  } catch (err) {
    console.error("[easyslip] request failed:", err);
    return { status: "ERROR", message: "เรียก EasySlip API ไม่สำเร็จ (เครือข่ายขัดข้องหรือบริการไม่พร้อมใช้งาน)" };
  }

  if (!json.success || !json.data) {
    const code = json.error?.code;
    if (code === "SLIP_NOT_FOUND") {
      return { status: "INVALID_SLIP", message: "ไม่พบข้อมูลสลิปนี้ในระบบธนาคาร (อาจเป็นสลิปปลอม รูปไม่ชัด หรือไม่มี QR)" };
    }
    if (code === "SLIP_PENDING") {
      return { status: "ERROR", message: "ธนาคารต้นทางยังไม่ส่งข้อมูลสลิปนี้เข้าระบบ (พบบ่อยกับสลิปกรุงเทพ) ลองตรวจสอบใหม่ภายหลัง" };
    }
    // EasySlip v2 ตอบ VALIDATION_ERROR "Please provide either a payload string..." เมื่ออ่าน QR
    // สลิปจากรูปไม่ได้ (รูปไม่ใช่สลิป/ไม่มี QR/ถูกครอบตัด) — ยืนยันจากการทดสอบจริงกับรูปที่ไม่มี QR
    if (code === "VALIDATION_ERROR" && /provide either a payload/i.test(json.error?.message || "")) {
      return { status: "INVALID_SLIP", message: "อ่าน QR ในรูปสลิปไม่ได้ (อาจไม่ใช่สลิปโอนเงิน รูปไม่ชัด หรือ QR ถูกครอบตัด)" };
    }
    if (code === "QUOTA_EXCEEDED" || code === "RATE_LIMIT_EXCEEDED") {
      return { status: "ERROR", message: "โควต้าการตรวจสอบสลิปของ EasySlip เต็มแล้วในรอบนี้" };
    }
    return { status: "ERROR", message: `ตรวจสอบสลิปไม่สำเร็จ: ${json.error?.message || code || "ไม่ทราบสาเหตุ"}` };
  }

  const slip = json.data.rawSlip;
  const actualAmount = Number(slip.amount?.amount);

  // EasySlip ตอบ isDuplicate=true ทุกครั้งที่ "บัญชี EasySlip ของเรา" เคยตรวจสลิปใบนี้มาก่อน
  // ซึ่งรวมถึงตอนกด "ตรวจสอบใหม่" กับสลิปของรายการเดิม — จึงต้องเช็กในฐานข้อมูลเราเองว่า
  // เลขอ้างอิงนี้ผูกกับรายการอื่นจริงหรือไม่ (เช็กทุกครั้ง ไม่ว่า EasySlip จะบอกซ้ำหรือไม่)
  if (owner && slip.transRef) {
    let otherUse: string | null = null;
    try {
      otherUse = await findOtherUseOfTransRef(slip.transRef, owner);
    } catch (err) {
      console.error("[easyslip] duplicate lookup failed:", err);
    }
    if (otherUse) {
      return {
        status: "DUPLICATE",
        message: `สลิปนี้เคยใช้กับ${otherUse} มาแล้ว (เลขอ้างอิง ${slip.transRef})`,
        transRef: slip.transRef,
        actualAmount: Number.isFinite(actualAmount) ? actualAmount : undefined,
      };
    }
    // ไม่พบรายการอื่น → ความ "ซ้ำ" มาจากที่เราตรวจใบนี้เองก่อนหน้า ตรวจบัญชี/ยอดต่อตามปกติ
  } else if (json.data.isDuplicate) {
    return {
      status: "DUPLICATE",
      message: `สลิปนี้เคยถูกใช้ยืนยันการชำระเงินรายการอื่นมาแล้ว (เลขอ้างอิง ${slip.transRef})`,
      transRef: slip.transRef,
      actualAmount: Number.isFinite(actualAmount) ? actualAmount : undefined,
    };
  }

  if ("matchedAccount" in json.data && json.data.matchedAccount === null) {
    const receiverName = slip.receiver?.account?.name?.th || slip.receiver?.account?.name?.en || "ไม่ทราบชื่อ";
    const receiverBank = slip.receiver?.bank?.name ? ` (${slip.receiver.bank.name})` : "";
    return {
      status: "ACCOUNT_MISMATCH",
      message: `บัญชีผู้รับในสลิปไม่ใช่บัญชีรับเงินของงาน — ผู้รับ: ${receiverName}${receiverBank}`,
      transRef: slip.transRef,
      actualAmount: Number.isFinite(actualAmount) ? actualAmount : undefined,
    };
  }

  if (Number.isFinite(actualAmount) && Math.abs(actualAmount - expectedAmount) > AMOUNT_TOLERANCE_BAHT) {
    return {
      status: "AMOUNT_MISMATCH",
      message: `ยอดในสลิปจริง ${actualAmount.toLocaleString()} บาท ไม่ตรงกับยอดที่ต้องชำระ ${expectedAmount.toLocaleString()} บาท`,
      transRef: slip.transRef,
      actualAmount,
    };
  }

  return {
    status: "MATCH",
    message: `ตรวจสอบกับธนาคารแล้ว ยอด ${Number.isFinite(actualAmount) ? actualAmount.toLocaleString() : "-"} บาท ตรงกับยอดที่ต้องชำระ`,
    transRef: slip.transRef,
    actualAmount: Number.isFinite(actualAmount) ? actualAmount : undefined,
  };
}

/**
 * Fire-and-forget entry point for a table-booking slip (Reservation ->
 * PaymentSlip). Looks the slip row up by (reservationId, fileKey) rather
 * than requiring bookTable/bookPackage to return its id, so this can be
 * called from the API route with only what it already has on hand. Never
 * throws — callers just do `void verifyReservationSlipAsync(...).catch(...)`
 * the same way the existing "booking received" email fire-and-forget calls
 * are written.
 */
export async function verifyReservationSlipAsync(
  reservationId: string,
  slipFileKey: string,
  expectedAmount: number
): Promise<void> {
  try {
    const slip = await prisma.paymentSlip.findFirst({
      where: { reservationId, fileKey: slipFileKey },
      orderBy: { uploadedAt: "desc" },
    });
    if (!slip) return;

    const imageUrl = await presignedGetUrl(PAYMENT_SLIPS_BUCKET, slipFileKey);
    const result = await verifySlipByUrl(imageUrl, expectedAmount, { kind: "reservation", id: reservationId });

    await prisma.paymentSlip.update({
      where: { id: slip.id },
      data: {
        easyslipStatus: result.status,
        easyslipMessage: result.message,
        easyslipTransRef: result.transRef ?? null,
        easyslipCheckedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[easyslip] verifyReservationSlipAsync failed:", err);
  }
}

/** Same as verifyReservationSlipAsync, for a merch order's slip. */
export async function verifyMerchOrderSlipAsync(
  orderId: string,
  slipFileKey: string,
  expectedAmount: number
): Promise<void> {
  try {
    const slip = await prisma.merchPaymentSlip.findFirst({
      where: { orderId, fileKey: slipFileKey },
      orderBy: { uploadedAt: "desc" },
    });
    if (!slip) return;

    const imageUrl = await presignedGetUrl(PAYMENT_SLIPS_BUCKET, slipFileKey);
    const result = await verifySlipByUrl(imageUrl, expectedAmount, { kind: "merch", id: orderId });

    await prisma.merchPaymentSlip.update({
      where: { id: slip.id },
      data: {
        easyslipStatus: result.status,
        easyslipMessage: result.message,
        easyslipTransRef: result.transRef ?? null,
        easyslipCheckedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[easyslip] verifyMerchOrderSlipAsync failed:", err);
  }
}

/** Same as verifyReservationSlipAsync, for a ลงทะเบียนศิษย์เก่าดีเด่น/ผู้สนับสนุน slip
 * (the slip file key lives directly on the SupportRegistration row). */
export async function verifySupportRegistrationSlipAsync(
  registrationId: string,
  slipFileKey: string,
  expectedAmount: number
): Promise<void> {
  try {
    const imageUrl = await presignedGetUrl(PAYMENT_SLIPS_BUCKET, slipFileKey);
    const result = await verifySlipByUrl(imageUrl, expectedAmount, { kind: "support", id: registrationId });

    await prisma.supportRegistration.update({
      where: { id: registrationId },
      data: {
        easyslipStatus: result.status,
        easyslipMessage: result.message,
        easyslipTransRef: result.transRef ?? null,
        easyslipCheckedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[easyslip] verifySupportRegistrationSlipAsync failed:", err);
  }
}
