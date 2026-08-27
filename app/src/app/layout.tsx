import type { Metadata } from "next";
import { Pridi, Sarabun } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "งานคืนสู่เหย้า - ระบบจองโต๊ะศิษย์เก่า",
  description: "ระบบจองโต๊ะงานคืนสู่เหย้าวิทยาลัยอาชีวศึกษา",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body
        className={`${displayFont.variable} ${bodyFont.variable} min-h-screen bg-cream-100 text-stone-800`}
      >
        {children}
      </body>
    </html>
  );
}
