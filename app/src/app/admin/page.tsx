"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DashboardData {
  events: { total: number; open: number; draft: number; closed: number };
  reservations: { total: number; pending: number; confirmed: number; confirmedRevenue: number; checkedIn: number };
  merch: { total: number; pending: number; confirmed: number; confirmedRevenue: number };
  alumni: { total: number };
  recentEvents: {
    id: string;
    name: string;
    eventDate: string;
    status: "draft" | "open" | "closed";
    tableCount: number;
    reservationCount: number;
  }[];
}

const STATUS_LABEL: Record<string, string> = { draft: "ร่าง", open: "เปิดจอง", closed: "ปิดรับจอง" };
const STATUS_BADGE: Record<string, string> = {
  draft: "bg-stone-200 text-stone-600",
  open: "bg-emerald-100 text-emerald-700",
  closed: "bg-maroon-100 text-maroon-700",
};

function StatIcon({ name }: { name: string }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "calendar")
    return (
      <svg {...common} className="w-5 h-5">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    );
  if (name === "ticket")
    return (
      <svg {...common} className="w-5 h-5">
        <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V9z" />
        <path d="M10 7v10" strokeDasharray="2 3" />
      </svg>
    );
  if (name === "coin")
    return (
      <svg {...common} className="w-5 h-5">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2 0 0 1 2.5-1.5c1.5 0 2.5 1 2.5 2s-1 1.5-2.5 2-2.5 1-2.5 2 1 2 2.5 2a2.5 2 0 0 0 2.5-1.5" />
        <path d="M12 6.5v11" />
      </svg>
    );
  if (name === "checkin")
    return (
      <svg {...common} className="w-5 h-5">
        <path d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  if (name === "users")
    return (
      <svg {...common} className="w-5 h-5">
        <circle cx="9" cy="8" r="3.25" />
        <path d="M3.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M15.5 14a5 5 0 0 1 5 6" />
      </svg>
    );
  return (
    <svg {...common} className="w-5 h-5">
      <path d="M6 8h12l-1 12H7z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </svg>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone = "primary",
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  tone?: "primary" | "maroon";
}) {
  return (
    <div className="bg-white rounded-xl border border-cream-200 shadow-md p-4 flex items-start gap-3">
      <span
        className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${
          tone === "maroon" ? "bg-maroon-50 text-maroon-700" : "bg-primary-50 text-primary-700"
        }`}
      >
        <StatIcon name={icon} />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-stone-500">{label}</div>
        <div className="text-xl font-display font-semibold text-stone-800 leading-tight mt-0.5">{value}</div>
        {sub && <div className="text-xs text-stone-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

const QUICK_LINKS = [
  { href: "/admin/events/new", label: "สร้างงานเลี้ยงใหม่", icon: "calendar" },
  { href: "/admin/checkin", label: "ค้นหาเพื่อเช็คอิน", icon: "checkin" },
  { href: "/admin/alumni", label: "ทำเนียบศิษย์เก่า", icon: "users" },
  { href: "/admin/merch/orders", label: "คำสั่งซื้อของที่ระลึก", icon: "ticket" },
  { href: "/admin/merch/products", label: "จัดการสินค้า/สต๊อก", icon: "box" },
];

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <p className="text-stone-500">กำลังโหลด...</p>;

  const totalRevenue = data.reservations.confirmedRevenue + data.merch.confirmedRevenue;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-stone-800">แดชบอร์ด</h1>
        <p className="text-sm text-stone-500 mt-0.5">ภาพรวมระบบจองโต๊ะและคำสั่งซื้อของที่ระลึกทั้งหมด</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon="calendar"
          label="งานเลี้ยงทั้งหมด"
          value={String(data.events.total)}
          sub={`เปิดจอง ${data.events.open} · ร่าง ${data.events.draft} · ปิด ${data.events.closed}`}
        />
        <StatCard
          icon="ticket"
          label="การจองโต๊ะทั้งหมด"
          value={String(data.reservations.total)}
          sub={`ยืนยันแล้ว ${data.reservations.confirmed} · รอตรวจสอบ ${data.reservations.pending}`}
          tone="maroon"
        />
        <StatCard
          icon="coin"
          label="ยอดเงินยืนยันแล้ว"
          value={`${totalRevenue.toLocaleString()} บาท`}
          sub={`จองโต๊ะ ${data.reservations.confirmedRevenue.toLocaleString()} · ของที่ระลึก ${data.merch.confirmedRevenue.toLocaleString()}`}
        />
        <StatCard
          icon="checkin"
          label="เช็คอินแล้ว"
          value={String(data.reservations.checkedIn)}
          sub={`จาก ${data.reservations.confirmed} รายการที่ยืนยันแล้ว`}
          tone="maroon"
        />
        <StatCard icon="users" label="ศิษย์เก่าลงทะเบียน" value={String(data.alumni.total)} />
        <StatCard
          icon="ticket"
          label="คำสั่งซื้อของที่ระลึก"
          value={String(data.merch.total)}
          sub={`ยืนยันแล้ว ${data.merch.confirmed} · รอตรวจสอบ ${data.merch.pending}`}
          tone="maroon"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-cream-200 shadow-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
            <h2 className="font-display font-semibold text-stone-800">งานเลี้ยงล่าสุด</h2>
            <Link href="/admin/events" className="text-sm text-maroon-700 hover:text-maroon-800 hover:underline">
              ดูทั้งหมด
            </Link>
          </div>
          {data.recentEvents.length === 0 ? (
            <p className="p-6 text-center text-stone-400 text-sm">ยังไม่มีงานที่สร้างไว้</p>
          ) : (
            <div className="divide-y divide-cream-100">
              {data.recentEvents.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/admin/events/${ev.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-cream-50/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-stone-800 truncate">{ev.name}</div>
                    <div className="text-xs text-stone-500">
                      {new Date(ev.eventDate).toLocaleDateString("th-TH", { dateStyle: "long" })} · {ev.tableCount} โต๊ะ ·{" "}
                      {ev.reservationCount} การจอง
                    </div>
                  </div>
                  <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[ev.status]}`}>
                    {STATUS_LABEL[ev.status]}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-cream-200 shadow-md p-5">
          <h2 className="font-display font-semibold text-stone-800 mb-3">ทางลัด</h2>
          <div className="flex flex-col gap-1.5">
            {QUICK_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-stone-600 hover:bg-cream-50 hover:text-maroon-700 transition-colors"
              >
                <span className="text-primary-600">
                  <StatIcon name={l.icon} />
                </span>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
