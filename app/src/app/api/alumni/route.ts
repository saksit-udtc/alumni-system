import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public self-registration into the alumni directory — no admin auth, by
 * design (this is the "ฉันเป็นศิษย์เก่า" checkbox on the booking form, see
 * reserve-form.tsx, which already POSTs here). Ported from the old
 * Supabase app's public app/api/alumni/route.ts POST handler; this new
 * scaffold's admin-only listing/creation lives separately at
 * /api/admin/alumni and is unaffected by this route.
 *
 * Deliberately best-effort from the caller's side (reserve-form.tsx treats
 * a failure here as non-fatal — the booking itself already succeeded by
 * the time this fires), but this handler itself still validates and
 * returns real errors/statuses rather than silently swallowing them, so
 * they show up in server logs if something is actually wrong.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.fullName?.trim()) {
    return NextResponse.json({ error: "กรุณากรอกชื่อ-นามสกุล" }, { status: 400 });
  }

  try {
    const alumnus = await prisma.alumni.create({
      data: {
        fullName: body.fullName.trim(),
        graduationYear: body.graduationYear || null,
        department: body.department || null,
        currentOccupation: body.currentOccupation || null,
        phone: body.phone || null,
        email: body.email || null,
        lineId: body.lineId || null,
      },
    });
    return NextResponse.json({ alumnus }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/alumni]", err);
    return NextResponse.json({ error: "ลงทะเบียนศิษย์เก่าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
