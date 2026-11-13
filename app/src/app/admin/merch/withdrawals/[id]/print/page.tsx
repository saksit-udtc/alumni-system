"use client";

import { useEffect, useState } from "react";

type Item = { id: string; productName: string; size: string | null; quantity: number; unitPrice: string | number };
type W = {
  code: string;
  requesterName: string;
  requesterPosition: string | null;
  purpose: string;
  approverName: string;
  note: string | null;
  status: "active" | "cancelled";
  createdAt: string;
  items: Item[];
  createdBy: { username: string };
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
const n = (v: number) => v.toLocaleString("th-TH");

// ใบเบิกของที่ระลึก ขนาด A4 พิมพ์ผ่านหน้าต่างพิมพ์ของเบราว์เซอร์ — มีช่องลงนาม ผู้เบิก / ผู้อนุมัติ / ผู้จ่ายของ
export default function WithdrawalPrintPage({ params }: { params: { id: string } }) {
  const [w, setW] = useState<W | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/merch/withdrawals/${params.id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || "โหลดไม่สำเร็จ");
        setW(d.withdrawal);
      })
      .catch((e) => setError(e.message));
  }, [params.id]);

  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!w) return <p className="p-6 text-stone-500">กำลังโหลด...</p>;

  const totalQty = w.items.reduce((a, i) => a + i.quantity, 0);
  const totalValue = w.items.reduce((a, i) => a + i.quantity * Number(i.unitPrice), 0);
  const sign = (label: string, name: string) => (
    <div className="text-center text-sm">
      <div className="h-14" />
      <div className="border-b border-dotted border-stone-700 mx-4" />
      <div className="mt-1">({name || "......................................."})</div>
      <div className="text-stone-600">{label}</div>
      <div className="text-stone-600">วันที่ ........./........./.........</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 text-stone-900 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 15mm; } .no-print { display: none !important; } }`}</style>
      <div className="no-print mb-4 flex gap-3">
        <button onClick={() => window.print()} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white">พิมพ์ใบเบิก</button>
      </div>

      <div className="text-center">
        <div className="text-lg font-bold">ใบเบิกของที่ระลึก</div>
        <div className="text-sm">งานคืนสู่เหย้า วิทยาลัยเทคนิคอุดรธานี</div>
        {w.status === "cancelled" && <div className="mt-1 text-base font-bold text-red-600">*** ยกเลิกแล้ว ***</div>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
        <div>เลขที่ใบเบิก: <b>{w.code}</b></div>
        <div className="text-right">วันที่: {fmtDate(w.createdAt)}</div>
        <div className="col-span-2">ผู้เบิก: <b>{w.requesterName}</b>{w.requesterPosition ? ` (${w.requesterPosition})` : ""}</div>
        <div className="col-span-2">วัตถุประสงค์: <b>{w.purpose}</b></div>
        {w.note && <div className="col-span-2">หมายเหตุ: {w.note}</div>}
      </div>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-stone-100">
            <th className="border border-stone-400 px-2 py-1 w-10">ที่</th>
            <th className="border border-stone-400 px-2 py-1 text-left">รายการ</th>
            <th className="border border-stone-400 px-2 py-1 w-20">ไซซ์</th>
            <th className="border border-stone-400 px-2 py-1 w-20">จำนวน</th>
            <th className="border border-stone-400 px-2 py-1 w-28 text-right">มูลค่า (บาท)</th>
          </tr>
        </thead>
        <tbody>
          {w.items.map((i, idx) => (
            <tr key={i.id}>
              <td className="border border-stone-400 px-2 py-1 text-center">{idx + 1}</td>
              <td className="border border-stone-400 px-2 py-1">{i.productName}</td>
              <td className="border border-stone-400 px-2 py-1 text-center">{i.size ?? "-"}</td>
              <td className="border border-stone-400 px-2 py-1 text-center">{i.quantity}</td>
              <td className="border border-stone-400 px-2 py-1 text-right">{n(i.quantity * Number(i.unitPrice))}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="border border-stone-400 px-2 py-1 text-right" colSpan={3}>รวม</td>
            <td className="border border-stone-400 px-2 py-1 text-center">{totalQty}</td>
            <td className="border border-stone-400 px-2 py-1 text-right">{n(totalValue)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-stone-600">* เป็นการเบิกไปใช้งาน ไม่มีการชำระเงิน มูลค่าที่แสดงเป็นราคาขายตามป้าย ณ วันที่เบิก เพื่อใช้เป็นข้อมูลอ้างอิงเท่านั้น</p>

      <div className="mt-10 grid grid-cols-3 gap-4">
        {sign("ผู้เบิก", w.requesterName)}
        {sign("ผู้อนุมัติ", w.approverName)}
        {sign("ผู้จ่ายของ", w.createdBy.username)}
      </div>
    </div>
  );
}
