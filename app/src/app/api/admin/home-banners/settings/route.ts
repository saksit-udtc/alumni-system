import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { getHomeBannerIntervalSeconds, setHomeBannerIntervalSeconds } from "@/lib/settings";

// Admin: view/update how many seconds the homepage promo slider shows each
// banner before auto-advancing to the next one.
export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const intervalSeconds = await getHomeBannerIntervalSeconds();
  return NextResponse.json({ intervalSeconds });
}

export async function PUT(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("invalid body");

  const seconds = Number(body.intervalSeconds);
  if (!Number.isFinite(seconds) || seconds < 1) {
    return jsonError("กรุณากรอกเวลาเป็นตัวเลขวินาทีที่มากกว่าหรือเท่ากับ 1");
  }

  await setHomeBannerIntervalSeconds(seconds);
  return NextResponse.json({ ok: true, intervalSeconds: seconds });
}
