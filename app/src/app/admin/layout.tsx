"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/admin/login") return <>{children}</>;

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div className="space-y-4 p-4 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link href="/admin/events" className="hover:underline">
            งานเลี้ยง
          </Link>
          <Link href="/admin/checkin" className="hover:underline">
            เช็คอิน
          </Link>
          <Link href="/admin/alumni" className="hover:underline">
            ทำเนียบศิษย์เก่า
          </Link>
          <Link href="/admin/merch/orders" className="hover:underline">
            คำสั่งซื้อของที่ระลึก
          </Link>
          <Link href="/admin/merch/products" className="hover:underline">
            จัดการสินค้า/สต๊อก
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm text-blue-500 min-w-0">
          <button onClick={logout} className="hover:underline">
            ออกจากระบบ
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}