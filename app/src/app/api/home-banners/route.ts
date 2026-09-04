import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicHomeBannerUrl } from "@/lib/minio";
import { getHomeBannerIntervalSeconds } from "@/lib/settings";

// Public — the homepage promotional slider reads only active banners,
// ordered the way the admin arranged them, plus the admin-configured
// autoplay interval.
export async function GET() {
  const [banners, intervalSeconds] = await Promise.all([
    prisma.homeBanner.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    getHomeBannerIntervalSeconds(),
  ]);

  return NextResponse.json({
    intervalSeconds,
    banners: banners.map((b) => ({
      id: b.id,
      title: b.title,
      linkUrl: b.linkUrl,
      imageUrl: publicHomeBannerUrl(b.imageKey),
    })),
  });
}
