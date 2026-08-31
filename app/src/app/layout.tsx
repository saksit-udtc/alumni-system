import type { Metadata } from "next";
import { Pridi, Sarabun } from "next/font/google";
import "./globals.css";
import PageViewLogger from "./components/page-view-logger";

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

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: siteTitle,
    images: [
      {
        url: "/logo.jpg",
        width: 800,
        height: 800,
        alt: siteTitle,
      },
    ],
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/logo.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body
        className={`${displayFont.variable} ${bodyFont.variable} min-h-screen bg-cream-100 text-stone-800`}
      >
        <PageViewLogger />
        {children}
      </body>
    </html>
  );
}
