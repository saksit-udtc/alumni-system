import { NextRequest, NextResponse } from "next/server";
import { logPublicView } from "@/lib/auditLog";

/**
 * Anonymous public page-view logging: path + timestamp only, no cookies, no
 * IP, no other visitor-identifying data read or stored. Called by
 * <PageViewLogger> on every non-admin page.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const path = typeof body?.path === "string" ? body.path.slice(0, 300) : null;
  if (!path) {
    return NextResponse.json({ error: "INVALID_PATH" }, { status: 400 });
  }
  await logPublicView(path);
  return NextResponse.json({ ok: true });
}
