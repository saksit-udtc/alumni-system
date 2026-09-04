import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { getLandingContent, setLandingContent } from "@/lib/settings";
import { sanitizeLandingContent } from "@/lib/landingContent";

// Admin: view/replace the editable content of the public homepage (the
// 89th-anniversary landing page). The whole document is edited and saved
// as one JSON blob from /admin/landing — see lib/landingContent.ts.
export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const content = await getLandingContent();
  return NextResponse.json({ content });
}

export async function PUT(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("invalid body");

  const clean = sanitizeLandingContent(body);
  const saved = await setLandingContent(clean);
  return NextResponse.json({ content: saved });
}
