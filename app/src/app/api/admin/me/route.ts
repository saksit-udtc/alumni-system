import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiHelpers";

/** Lets the admin UI know who's logged in and their role, to filter the nav menu. */
export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req);
  if (response) return response;
  return NextResponse.json({ username: admin.username, role: admin.role });
}
