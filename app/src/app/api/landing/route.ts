import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLandingContent } from "@/lib/settings";
import { publicLandingGalleryUrl } from "@/lib/minio";

// Public: everything the homepage (app/page.tsx) needs to render the 89th
// anniversary landing page — the editable content JSON plus the active
// gallery photos, in display order.
export async function GET() {
  const [content, gallery] = await Promise.all([
    getLandingContent(),
    prisma.landingGalleryImage.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return NextResponse.json({
    content,
    gallery: gallery.map((g) => ({
      id: g.id,
      imageUrl: publicLandingGalleryUrl(g.imageKey),
      caption: g.caption,
      category: g.category,
    })),
  });
}
