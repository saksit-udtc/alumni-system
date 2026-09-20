import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";
import { presignedGetUrl, PAYMENT_SLIPS_BUCKET } from "@/lib/minio";

export const dynamic = "force-dynamic";

/**
 * Stable "view slip" link for admin pages.
 *
 * Slip images live in a private MinIO bucket and can only be read through a
 * short-lived presigned URL. Embedding that URL in the list APIs meant the
 * link died a few minutes after the page loaded ("Request has expired").
 * Instead the list APIs now return this permanent same-origin path; when an
 * admin clicks it we check their role and 302-redirect to a freshly signed
 * URL, so the link never goes stale.
 *
 *   GET /api/admin/slip/reservation/<reservationId>   latest PaymentSlip
 *   GET /api/admin/slip/merch/<orderId>               latest MerchPaymentSlip
 *   GET /api/admin/slip/support/<supportRegistrationId>
 *
 * Roles mirror the list APIs that expose each kind of slip.
 */
const KIND_ROLES = {
  reservation: ["SUPER_ADMIN", "FINANCE_STAFF", "RESERVATION_STAFF"],
  merch: ["SUPER_ADMIN", "MERCH_STAFF", "FINANCE_STAFF", "RESERVATION_STAFF"],
  support: ["SUPER_ADMIN", "FINANCE_STAFF"],
} as const;

// The signed URL is used immediately by the redirect, so it can be very short.
const REDIRECT_TTL_SECONDS = 120;

export async function GET(req: NextRequest, { params }: { params: { kind: string; id: string } }) {
  const kind = params.kind as keyof typeof KIND_ROLES;
  const roles = KIND_ROLES[kind];
  if (!roles) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const { response } = requireAdmin(req, [...roles]);
  if (response) return response;

  let fileKey: string | null = null;
  if (kind === "reservation") {
    const slip = await prisma.paymentSlip.findFirst({
      where: { reservationId: params.id },
      orderBy: { uploadedAt: "desc" },
      select: { fileKey: true },
    });
    fileKey = slip?.fileKey ?? null;
  } else if (kind === "merch") {
    const slip = await prisma.merchPaymentSlip.findFirst({
      where: { orderId: params.id },
      orderBy: { uploadedAt: "desc" },
      select: { fileKey: true },
    });
    fileKey = slip?.fileKey ?? null;
  } else {
    const reg = await prisma.supportRegistration.findUnique({
      where: { id: params.id },
      select: { slipFileKey: true },
    });
    fileKey = reg?.slipFileKey ?? null;
  }

  if (!fileKey) return NextResponse.json({ error: "SLIP_NOT_FOUND" }, { status: 404 });

  const url = await presignedGetUrl(PAYMENT_SLIPS_BUCKET, fileKey, REDIRECT_TTL_SECONDS);
  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
