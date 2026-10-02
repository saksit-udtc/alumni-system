"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminStatCard } from "@/app/components/admin-stat-card";
import { DonutChart, LineAreaChart, themeColor } from "@/app/components/admin-charts";

interface DashboardData {
  events: { total: number; open: number; draft: number; closed: number };
  reservations: {
    total: number;
    pending: number;
    confirmed: number;
    confirmedRevenue: number;
    checkedIn: number;
    byStatus: Record<string, number>;
  };
  merch: { total: number; pending: number; confirmed: number; confirmedRevenue: number; toShip: number; shipped: number; byStatus: Record<string, number> };
  alumni: { total: number };
  rangeDays: number;
  daily: { date: string; count: number }[];
  merchDaily: { date: string; count: number }[];
  recentMerchOrders: {
    id: string;
    orderCode: string;
    bookerName: string;
    totalAmount: number;
    paymentStatus: string;
    createdAt: string;
    itemCount: number;
  }[];
  recentReservations: {
    id: string;
    bookingCode: string;
    bookerName: string;
    tableNumber: number;
    totalAmount: number;
    paymentStatus: string;
    createdAt: string;
    easyslipStatus: string | null;
  }[];
}

// สถานะการชำระเงินของการจอง (ข้อความ/สีเดียวกับหน้า /admin/reservations)
const PAY_LABEL: Record<string, string> = {
  pending: "รอชำระเงิน",
  awaiting_verify: "รอตรวจสอบสลิป",
  confirmed: "ยืนยันแล้ว",
  rejected: "สลิปถูกปฏิเสธ",
  expired: "หมดเวลา",
};
const PAY_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  awaiting_verify: "bg-maroon-50 text-maroon-700 border border-maroon-200",
  confirmed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
  expired: "bg-stone-100 text-stone-500 border border-stone-200",
};
// สีในวงแหวน: สถานะที่มีความหมายตายตัว (เขียว=สำเร็จ, แดง=ปฏิเสธ) ใช้สีเดียวกันทุกธีม ส่วนที่เหลือใช้สีธีม
const PAY_COLOR: Record<string, string> = {
  confirmed: "#059669",
  pending: themeColor("primary", 500),
  awaiting_verify: themeColor("maroon", 500),
  expired: "#a8a29e",
  rejected: "#dc2626",
};
const PAY_ORDER = ["confirmed", "pending", "awaiting_verify", "expired", "rejected"];

const thDate = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T12:00:00+07:00`).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", ...opts });

function Card({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-xl border border-cream-200 shadow-md ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="font-display font-semibold text-stone-800">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [days, setDays] = useState(7);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    fetch(`/api/admin/dashboard?days=${days}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 403 ? "ไม่มีสิทธิ์ดูแดชบอร์ด" : "โหลดข้อมูลไม่สำเร็จ");
        return r.json();
      })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => !cancelled && setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => !cancelled && setChartLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (error && !data) return <p className="text-red-600 text-sm">{error}</p>;
  if (!data) return <p className="text-stone-500">กำลังโหลด...</p>;

  const totalRevenue = data.reservations.confirmedRevenue + data.merch.confirmedRevenue;
  const slices = PAY_ORDER.map((k) => ({ label: PAY_LABEL[k], value: data.reservations.byStatus[k] || 0, color: PAY_COLOR[k] }));
  const sliceTotal = slices.reduce((a, s) => a + s.value, 0);
  const points = data.daily.map((d) => ({
    value: d.count,
    label: data.rangeDays <= 7 ? thDate(d.date, { weekday: "short" }) : thDate(d.date, { day: "numeric", month: "numeric" }),
    tip: `${thDate(d.date, { day: "numeric", month: "short" })} · จอง ${d.count} รายการ`,
  }));
  const rangeTotal = data.daily.reduce((a, d) => a + d.count, 0);

  const merchSlices = PAY_ORDER.map((k) => ({ label: PAY_LABEL[k], value: data.merch.byStatus[k] || 0, color: PAY_COLOR[k] }));
  const merchSliceTotal = merchSlices.reduce((a, x) => a + x.value, 0);
  // สถานะการจัดส่ง: จัดส่งแล้ว (มีเลขพัสดุ) vs รอจัดส่ง (ยืนยันชำระแล้วแต่ยังไม่มีเลขพัสดุ)
  const shipSlices = [
    { label: "จัดส่งแล้ว", value: data.merch.shipped, color: "#059669" },
    { label: "รอจัดส่ง", value: data.merch.toShip, color: themeColor("primary", 500) },
  ];
  const shipTotal = shipSlices.reduce((a, x) => a + x.value, 0);
  const merchPoints = data.merchDaily.map((d) => ({
    value: d.count,
    label: data.rangeDays <= 7 ? thDate(d.date, { weekday: "short" }) : thDate(d.date, { day: "numeric", month: "numeric" }),
    tip: `${thDate(d.date, { day: "numeric", month: "short" })} · สั่งซื้อ ${d.count} รายการ`,
  }));
  const merchRangeTotal = data.merchDaily.reduce((a, d) => a + d.count, 0);
  const labelEvery = data.rangeDays <= 7 ? 1 : data.rangeDays <= 14 ? 2 : 5;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">แดชบอร์ด</h1>
          <p className="text-sm text-stone-500 mt-0.5">ภาพรวมระบบจองโต๊ะและคำสั่งซื้อของที่ระลึกทั้งหมด</p>
        </div>
        <label className="text-sm text-stone-500 flex items-center gap-2">
          ช่วงเวลากราฟ
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="border border-stone-300 rounded-lg px-3 py-1.5 text-stone-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value={7}>7 วันล่าสุด</option>
            <option value={14}>14 วันล่าสุด</option>
            <option value={30}>30 วันล่าสุด</option>
          </select>
        </label>
      </div>

      {/* สถิติสำคัญ */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <AdminStatCard
          icon="ticket"
          label="การจองโต๊ะทั้งหมด"
          value={String(data.reservations.total)}
          sub={`ยืนยันแล้ว ${data.reservations.confirmed} · รอตรวจสอบ ${data.reservations.pending}`}
          tone="navy"
        />
        <AdminStatCard
          icon="coin"
          label="ยอดเงินยืนยันแล้ว"
          value={`${totalRevenue.toLocaleString()} บาท`}
          sub={`จองโต๊ะ ${data.reservations.confirmedRevenue.toLocaleString()} · ของที่ระลึก ${data.merch.confirmedRevenue.toLocaleString()}`}
          tone="emerald"
        />
        <AdminStatCard
          icon="checkin"
          label="เช็คอินแล้ว"
          value={String(data.reservations.checkedIn)}
          sub={`จาก ${data.reservations.confirmed} รายการที่ยืนยันแล้ว`}
          tone="gold"
        />
        <AdminStatCard
          icon="bag"
          label="คำสั่งซื้อของที่ระลึก"
          value={String(data.merch.total)}
          sub={`ยืนยันแล้ว ${data.merch.confirmed} · จัดส่งแล้ว ${data.merch.shipped} · รอส่ง ${data.merch.toShip}`}
          tone="navy"
        />
        <AdminStatCard icon="users" label="ศิษย์เก่าลงทะเบียน" value={String(data.alumni.total)} tone="gold" />
        <AdminStatCard
          icon="calendar"
          label="งานเลี้ยงทั้งหมด"
          value={String(data.events.total)}
          sub={`เปิดจอง ${data.events.open} · ร่าง ${data.events.draft} · ปิด ${data.events.closed}`}
          tone="slate"
        />
      </div>

      {/* กราฟ */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card
          className="lg:col-span-2"
          title="การจองรายวัน"
          right={<span className="text-xs text-stone-500">รวม {rangeTotal.toLocaleString()} รายการใน {data.rangeDays} วัน</span>}
        >
          <div className={`px-4 pb-4 transition-opacity ${chartLoading ? "opacity-50" : ""}`}>
            <LineAreaChart
              points={points}
              ariaLabel={`กราฟเส้นจำนวนการจองรายวัน ${data.rangeDays} วันล่าสุด รวม ${rangeTotal} รายการ`}
              labelEvery={labelEvery}
            />
          </div>
        </Card>

        <Card title="สถานะการจอง">
          <div className="px-5 pb-5 flex flex-col items-center gap-4">
            <DonutChart slices={slices} centerLabel="รายการจอง" ariaLabel="แผนภูมิวงแหวนสัดส่วนสถานะการจองโต๊ะ" />
            <ul className="w-full space-y-1.5 text-sm">
              {slices.map((s) => (
                <li key={s.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                  <span className="text-stone-600">{s.label}</span>
                  <span className="ml-auto font-semibold text-stone-800">{s.value.toLocaleString()}</span>
                  <span className="w-10 text-right text-stone-400">{sliceTotal ? Math.round((s.value / sliceTotal) * 100) : 0}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* กราฟของที่ระลึก */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card
          className="lg:col-span-2"
          title="การสั่งซื้อของที่ระลึกรายวัน"
          right={<span className="text-xs text-stone-500">รวม {merchRangeTotal.toLocaleString()} รายการใน {data.rangeDays} วัน</span>}
        >
          <div className={`px-4 pb-4 transition-opacity ${chartLoading ? "opacity-50" : ""}`}>
            <LineAreaChart
              points={merchPoints}
              ariaLabel={`กราฟเส้นจำนวนการสั่งซื้อของที่ระลึกรายวัน ${data.rangeDays} วันล่าสุด รวม ${merchRangeTotal} รายการ`}
              labelEvery={labelEvery}
            />
          </div>
        </Card>

        <Card title="สถานะการสั่งซื้อ">
          <div className="px-5 pb-5 flex flex-col items-center gap-4">
            <DonutChart slices={merchSlices} centerLabel="คำสั่งซื้อ" ariaLabel="แผนภูมิวงแหวนสัดส่วนสถานะการสั่งซื้อของที่ระลึก" />
            <ul className="w-full space-y-1.5 text-sm">
              {merchSlices.map((x) => (
                <li key={x.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: x.color }} />
                  <span className="text-stone-600">{x.label}</span>
                  <span className="ml-auto font-semibold text-stone-800">{x.value.toLocaleString()}</span>
                  <span className="w-10 text-right text-stone-400">{merchSliceTotal ? Math.round((x.value / merchSliceTotal) * 100) : 0}%</span>
                </li>
              ))}
            </ul>
            <div className="w-full border-t border-cream-200 pt-3">
              <div className="text-sm font-semibold text-stone-700 mb-2">สถานะการจัดส่ง</div>
              <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-stone-100 mb-2">
                {shipSlices.map((x) => (
                  <div key={x.label} style={{ width: `${shipTotal ? (x.value / shipTotal) * 100 : 0}%`, background: x.color }} />
                ))}
              </div>
              <ul className="space-y-1.5 text-sm">
                {shipSlices.map((x) => (
                  <li key={x.label} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: x.color }} />
                    <span className="text-stone-600">{x.label}</span>
                    <span className="ml-auto font-semibold text-stone-800">{x.value.toLocaleString()}</span>
                    <span className="w-10 text-right text-stone-400">{shipTotal ? Math.round((x.value / shipTotal) * 100) : 0}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* รายการล่าสุด */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card
          className="overflow-hidden"
          title="รายการจองล่าสุด"
          right={
            <Link href="/admin/reservations" className="text-sm text-maroon-700 hover:text-maroon-800 hover:underline">
              ดูทั้งหมด
            </Link>
          }
        >
          {data.recentReservations.length === 0 ? (
            <p className="p-6 text-center text-stone-400 text-sm">ยังไม่มีรายการจอง</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream-100 text-left text-xs text-stone-500">
                  <th className="px-5 py-2 font-medium">รหัส / ผู้จอง</th>
                  <th className="px-3 py-2 font-medium text-right">ยอด</th>
                  <th className="px-5 py-2 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {data.recentReservations.map((r) => (
                  <tr key={r.id} className="hover:bg-cream-50/60">
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-stone-800 truncate max-w-[14rem]">{r.bookerName}</div>
                      <div className="text-xs text-stone-500">
                        {r.bookingCode} · โต๊ะ {r.tableNumber} ·{" "}
                        {new Date(r.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap text-stone-700">{r.totalAmount.toLocaleString()}</td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-block text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap ${PAY_BADGE[r.paymentStatus] || PAY_BADGE.expired}`}>
                        {PAY_LABEL[r.paymentStatus] || r.paymentStatus}
                      </span>
                      {r.easyslipStatus && r.easyslipStatus !== "SKIPPED" && (
                        <div className={`text-xs mt-1 ${r.easyslipStatus === "MATCH" ? "text-emerald-700" : "text-red-600"}`}>
                          {r.easyslipStatus === "MATCH" ? "✓ ตรงกับธนาคาร" : r.easyslipStatus === "ERROR" ? "ตรวจสอบไม่สำเร็จ" : "⚠ ไม่ตรง/น่าสงสัย"}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card
          className="overflow-hidden"
          title="รายการสั่งซื้อของที่ระลึกล่าสุด"
          right={
            <Link href="/admin/merch/orders" className="text-sm text-maroon-700 hover:text-maroon-800 hover:underline">
              ดูทั้งหมด
            </Link>
          }
        >
          {data.recentMerchOrders.length === 0 ? (
            <p className="p-6 text-center text-stone-400 text-sm">ยังไม่มีคำสั่งซื้อ</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream-100 text-left text-xs text-stone-500">
                  <th className="px-5 py-2 font-medium">รหัส / ผู้สั่งซื้อ</th>
                  <th className="px-3 py-2 font-medium text-right">ยอด</th>
                  <th className="px-5 py-2 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {data.recentMerchOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-cream-50/60">
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-stone-800 truncate max-w-[14rem]">{o.bookerName}</div>
                      <div className="text-xs text-stone-500">
                        {o.orderCode} · {o.itemCount} ชิ้น ·{" "}
                        {new Date(o.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap text-stone-700">{o.totalAmount.toLocaleString()}</td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-block text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap ${PAY_BADGE[o.paymentStatus] || PAY_BADGE.expired}`}>
                        {PAY_LABEL[o.paymentStatus] || o.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
