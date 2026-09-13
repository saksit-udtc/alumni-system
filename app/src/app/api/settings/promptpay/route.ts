import { NextResponse } from "next/server";
import { getPosPromptPayId } from "@/lib/settings";

// Public, unauthenticated — the PromptPay number itself is exactly what a
// paying customer needs to see (it's what they scan), so there's nothing
// to protect here. Reuses the same setting the POS payment screen uses
// (lib/settings.ts) since it's the same college PromptPay account either
// way; if no admin has set one yet this returns "" and callers (the online
// table-booking form, the merch checkout form) just skip showing a QR.
export const dynamic = "force-dynamic";

export async function GET() {
  const promptPayId = await getPosPromptPayId();
  return NextResponse.json({ promptPayId });
}
