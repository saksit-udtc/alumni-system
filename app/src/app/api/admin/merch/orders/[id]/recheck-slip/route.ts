import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { verifySlipByUrl } from "@/lib/easyslip";
import { presignedGetUrl, PAYMENT_SLIPS_BUCKET } from "@/lib/minio";

/**
 * Admin-triggered re-check of the latest slip against EasySlip. Exists
 * because EasySlip sometimes returns SLIP_PENDING ("ธนาคารต้นทางยังไม่ส่ง
 * ข้อมูลสลิปนี้เข้าระบบ") right after upload — especially for Bangkok Bank —
 * when the source bank hasn't reported the transaction yet. The admin can
 * wait a bit and press this to re-run the same check without asking the
 * customer to re-upload. Purely advisory like the original check: never
 * blocks/changes paymentStatus, only refreshes the EasySlip fields on the
 * latest MerchPaymentSlip row.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF", "FINANCE_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;

  const order = await prisma.merchOrder.findUnique({
    where: { id: params.id },
    include: { slips: { orderBy: { uploadedAt: "desc" }, take: 1 } },
  });
  if (!order) return jsonError("ไม่พบการสั่งซื้อที่ระบุ", 404);

  const latestSlip = order.slips[0];
  if (!latestSlip) return jsonError("ไม่พบสลิปของรายการนี้", 404);

  const imageUrl = await presignedGetUrl(PAYMENT_SLIPS_BUCKET, latestSlip.fileKey);
  const result = await verifySlipByUrl(imageUrl, Number(order.totalAmount), { kind: "merch", id: order.id });

  await prisma.merchPaymentSlip.update({
    where: { id: latestSlip.id },
    data: {
      easyslipStatus: result.status,
      easyslipMessage: result.message,
      easyslipTransRef: result.transRef ?? null,
      easyslipCheckedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    easyslipStatus: result.status,
    easyslipMessage: result.message,
  });
}
