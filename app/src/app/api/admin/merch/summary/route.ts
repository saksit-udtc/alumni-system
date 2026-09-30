import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiHelpers";
import { getSalesSummary } from "@/lib/salesSummary";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF", "FINANCE_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;
  return NextResponse.json(await getSalesSummary());
}
