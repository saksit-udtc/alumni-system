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
  status: "pending" | "paid" | "cancelled";
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
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    fetch("/api/admin/pos/sales")
      .then((r) => r.json())
      .then((d) => setSales(d.sales || []))
      .finally(() => setLoading(false));
  }, []);

  // ยกเลิกใบ "รอชำระ" + คืนสต๊อก (ใบที่ชำระแล้วยกเลิกจากหน้านี้ไม่ได้)
  async function cancelSale(s: Sale) {
    if (!window.confirm(`ยกเลิกรายการ ${s.saleCode} และคืนสินค้าเข้าสต๊อก ใช่หรือไม่?`)) return;
    setCancellingId(s.id);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/pos/sales/${s.id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "ยกเลิกไม่สำเร็จ");
      }
      const list = await fetch("/api/admin/pos/sales").then((r) => r.json());
      setSales(list.sales || []);
    } catch {
      setActionError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setCancellingId(null);
    }
  }

  // ยอดรวม/จำนวนนับเฉพาะใบที่ชำระแล้ว — รอชำระและยกเลิกไม่ใช่รายรับ
  const paidSales = sales.filter((s) => s.status === "paid");
  const pendingCount = sales.filter((s) => s.status === "pending").length;
  const totalRevenue = paidSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const totalItems = paidSales.reduce((sum, s) => sum + s.items.reduce((a, it) => a + it.quantity, 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">ประวัติการขายหน้างาน</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {paidSales.length} รายการขาย · {totalItems} ชิ้น · รวม {totalRevenue.toLocaleString()} บาท
            {pendingCount > 0 && <span className="text-amber-700 font-medium"> · รอชำระ {pendingCount} รายการ</span>}
          </p>
        </div>
        <Link href="/admin/pos" className="bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg px-4 py-2 text-sm font-semibold">
          + ขายหน้างาน
        </Link>
      </div>

      {actionError && <p className="text-red-600 text-sm">{actionError}</p>}

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
                <th className="px-4 py-2.5">สถานะ</th>
                <th className="px-4 py-2.5">ผู้ขาย</th>
                <th className="px-4 py-2.5 text-right">ยอดรวม</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className={`border-t border-cream-100 ${s.status === "cancelled" ? "text-stone-400" : ""}`}>
                  <td className="px-4 py-2.5 font-mono">
                    {s.saleCode}
                    {s.package && (
                      <div className="text-xs font-sans text-maroon-700 font-medium mt-0.5">แพ็กเกจ: {s.package.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-stone-500">{new Date(s.createdAt).toLocaleString("th-TH")}</td>
                  <td className="px-4 py-2.5">{s.items.reduce((a, it) => a + it.quantity, 0)} ชิ้น</td>
                  <td className="px-4 py-2.5">{PAYMENT_LABEL[s.paymentMethod] || s.paymentMethod}</td>
                  <td className="px-4 py-2.5">
                    {s.status === "pending" ? (
                      <span className="rounded-full bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5">รอชำระ</span>
                    ) : s.status === "cancelled" ? (
                      <span className="rounded-full bg-stone-200 text-stone-600 text-xs font-medium px-2 py-0.5">ยกเลิก</span>
                    ) : (
                      <span className="rounded-full bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5">ชำระแล้ว</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{s.cashier.username}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${s.status === "cancelled" ? "line-through" : "text-maroon-700"}`}>{Number(s.totalAmount).toLocaleString()}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Link href={`/admin/pos/receipt/${s.id}`} className="text-primary-700 hover:underline">
                        {s.status === "pending" ? "ดำเนินการ" : s.status === "cancelled" ? "ดูรายการ" : "ดูใบเสร็จ"}
                      </Link>
                      {s.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => cancelSale(s)}
                          disabled={cancellingId === s.id}
                          aria-label={`ยกเลิกรายการ ${s.saleCode}`}
                          title="ยกเลิกรายการ (คืนสต๊อก)"
                          className="flex items-center justify-center w-[33px] h-[33px] rounded-lg text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 transition-colors disabled:opacity-50"
                        >
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                        </button>
                      )}
                    </div>
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
