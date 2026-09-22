"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SaleItem {
  id: string;
  productName: string;
  size: string | null;
  quantity: number;
  unitPrice: string;
}
interface Sale {
  id: string;
  saleCode: string;
  paymentMethod: "cash" | "transfer";
  totalAmount: string;
  buyerName: string | null;
  createdAt: string;
  items: SaleItem[];
  cashier: { username: string };
  // Set only when this sale came from a merch-only Package (see
  // /admin/packages — a package that bundles souvenirs with no table).
  package: { name: string } | null;
}

const PAYMENT_LABEL: Record<string, string> = { cash: "เงินสด", transfer: "โอนเงิน" };

export default function PosSalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/pos/sales")
      .then((r) => r.json())
      .then((d) => setSales(d.sales || []))
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const totalItems = sales.reduce((sum, s) => sum + s.items.reduce((a, it) => a + it.quantity, 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">ประวัติการขายหน้างาน</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {sales.length} รายการขาย · {totalItems} ชิ้น · รวม {totalRevenue.toLocaleString()} บาท
          </p>
        </div>
        <Link href="/admin/pos" className="bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg px-4 py-2 text-sm font-semibold">
          + ขายหน้างาน
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-stone-400 text-center py-10">กำลังโหลด...</div>
      ) : sales.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-cream-200 p-10 text-center text-stone-400 text-sm">ยังไม่มีการขายหน้างาน</div>
      ) : (
        <div className="bg-white rounded-xl border border-cream-200 shadow-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream-50 text-stone-500 text-left">
              <tr>
                <th className="px-4 py-2.5">เลขที่</th>
                <th className="px-4 py-2.5">วันเวลา</th>
                <th className="px-4 py-2.5">รายการ</th>
                <th className="px-4 py-2.5">ชำระโดย</th>
                <th className="px-4 py-2.5">ผู้ขาย</th>
                <th className="px-4 py-2.5 text-right">ยอดรวม</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-t border-cream-100">
                  <td className="px-4 py-2.5 font-mono">
                    {s.saleCode}
                    {s.package && (
                      <div className="text-xs font-sans text-maroon-700 font-medium mt-0.5">แพ็กเกจ: {s.package.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-stone-500">{new Date(s.createdAt).toLocaleString("th-TH")}</td>
                  <td className="px-4 py-2.5">{s.items.reduce((a, it) => a + it.quantity, 0)} ชิ้น</td>
                  <td className="px-4 py-2.5">{PAYMENT_LABEL[s.paymentMethod] || s.paymentMethod}</td>
                  <td className="px-4 py-2.5">{s.cashier.username}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-maroon-700">{Number(s.totalAmount).toLocaleString()}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/pos/receipt/${s.id}`} className="text-primary-700 hover:underline">
                      ดูใบเสร็จ
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
