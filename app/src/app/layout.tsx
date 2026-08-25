import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "งานคืนสู่เหย้า - ระบบจองโต๊ะศิษย์เก่า",
  description: "ระบบจองโต๊ะงานคืนสู่เหย้าวิทยาลัยอาชีวศึกษา",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-blue-50 text-gray-800">{children}</body>
    </html>
  );
}
