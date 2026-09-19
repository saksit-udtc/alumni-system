import type { Metadata } from "next";
import { Pridi, Sarabun } from "next/font/google";
import "./globals.css";
import PageViewLogger from "./components/page-view-logger";
import { getSiteTheme } from "@/lib/settings";
import { getPosterInfo } from "@/lib/poster";

// อ่านธีมจากฐานข้อมูลทุกคำขอ (ไม่ prerender ตอน build ที่ไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

const displayFont = Pridi({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

const bodyFont = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
});

const siteUrl = "https://homecoming.udontech.ac.th";
const siteTitle = "งานคืนสู่เหย้า - ระบบจองโต๊ะศิษย์เก่า";
const siteDescription = "ระบบจองโต๊ะงานคืนสู่เหย้าวิทยาลัยเทคนิคอุดรธานี";

// รูปตัวอย่างเวลาแชร์ลิงก์ (LINE/Facebook) = โปสเตอร์งานที่ใช้งานอยู่ (จัดการที่ /admin/poster)
// ถ้าซ่อนโปสเตอร์ไว้ ใช้โลโก้เดิมแทน — อ่านฐานข้อมูลไม่ได้ก็ตกไปใช้โปสเตอร์เริ่มต้น
export async function generateMetadata(): Promise<Metadata> {
  const poster = await getPosterInfo();
  const image = !poster.enabled
    ? { url: "/logo.jpg", width: 800, height: 800, alt: siteTitle }
    : poster.isDefault
      ? { url: poster.imageUrl, width: 1055, height: 1491, alt: siteTitle }
      : { url: poster.imageUrl, alt: siteTitle };

  return {
    metadataBase: new URL(siteUrl),
    title: siteTitle,
    description: siteDescription,
    openGraph: {
      title: siteTitle,
      description: siteDescription,
      url: siteUrl,
      siteName: siteTitle,
      images: [image],
      locale: "th_TH",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: siteTitle,
      description: siteDescription,
      images: [image.url],
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getSiteTheme();
  return (
    <html lang="th" data-theme={theme}>
      <body
        className={`${displayFont.variable} ${bodyFont.variable} min-h-screen bg-cream-100 text-stone-800`}
      >
        <PageViewLogger />
        {children}
      </body>
    </html>
  );
}
