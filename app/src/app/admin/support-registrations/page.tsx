"use client";

import { useEffect, useMemo, useState } from "react";
import { UrlQuerySync, matchesQuery } from "@/app/components/admin-list-search";
import {
  AdminFilterBar,
  buildStatusOptions,
  countSlipCategories,
  matchesListFilters,
  slipCategory,
  useListFilters,
  type FilterableRow,
} from "@/app/components/admin-list-filters";
import { supportReward } from "@/lib/supportConfig";

interface Reg {
  id: string;
  code: string;
  type: "distinguished_alumni" | "sponsor";
  name: string;
  detail: string | null;
  phone: string;
  email: string;
  amount: number;
  paymentStatus: string;
  adminNote: string | null;
  easyslipStatus: string | null;
  easyslipMessage: string | null;
  createdAt: string;
  slipUrl: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  awaiting_verify: "รอตรวจสอบสลิป",
  pending: "รอชำระเงิน",
  confirmed: "ยืนยันแล้ว",
  rejected: "ปฏิเสธ",
  expired: "หมดเวลา",
};
const STATUS_BADGE: Record<string, string> = {
  awaiting_verify: "bg-amber-50 text-amber-700 border border-amber-200",
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  confirmed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
  expired: "bg-stone-100 text-stone-500 border border-stone-200",
};
// ผลตรวจสลิปอัตโนมัติจาก EasySlip — เป็นคำแนะนำเท่านั้น แอดมินยังกดอนุมัติเองได้เสมอ
function EasySlipBadge({ status, message }: { status: string | null; message: string | null }) {
  if (!status || status === "SKIPPED") return null;
  const ok = status === "MATCH";
  const label = ok ? "✓ ตรงกับธนาคาร" : status === "ERROR" ? "ตรวจสอบไม่สำเร็จ" : "⚠ ไม่ตรง/น่าสงสัย";
  return (
    <span
      title={message || ""}
      className={`inline-block whitespace-nowrap text-[11px] px-2 py-0.5 rounded-lg font-medium w-fit border ${
        ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
      }`}
    >
      {label}
    </span>
  );
}

const TYPE_LABEL = { distinguished_alumni: "ศิษย์เก่าดีเด่น", sponsor: "ผู้สนับสนุนงาน" } as const;

export default function AdminSupportRegistrationsPage() {
  const [rows, setRows] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Reg["type"]>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const filters = useListFilters();

  function load() {
    fetch("/api/admin/support-registrations")
      .then((r) => r.json())
      .then((d) => setRows(d.registrations || []))
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function act(id: string, action: "approve" | "reject") {
    let note = "";
    if (action === "reject") {
      const n = window.prompt("เหตุผลที่ปฏิเสธ (ไม่บังคับ)");
      if (n === null) return;
      note = n;
    } else if (!window.confirm("ยืนยันว่าตรวจสลิปแล้วและต้องการอนุมัติรายการนี้?")) {
      return;
    }
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/support-registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      if (!res.ok) setError((await res.json().catch(() => ({}))).error || "ดำเนินการไม่สำเร็จ");
      load();
    } finally {
      setBusyId(null);
    }
  }

  // ตัวเลขสถานะ/สลิปนับตามประเภทที่เลือกอยู่ (ทั้งหมด/ศิษย์เก่าดีเด่น/ผู้สนับสนุน)
  const typeRows = useMemo(() => rows.filter((r) => filter === "all" || r.type === filter), [rows, filter]);
  const filterRows: FilterableRow[] = useMemo(
    () =>
      typeRows.map((r) => ({
        status: r.paymentStatus,
        slip: slipCategory(!!r.slipUrl, r.easyslipStatus),
        createdAt: r.createdAt,
      })),
    [typeRows]
  );
  const shown = useMemo(
    () => typeRows.filter((r, i) => matchesQuery(q, [r.code, r.name, r.phone, r.email, r.detail]) && matchesListFilters(filters, filterRows[i])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [typeRows, filterRows, q, filters.status, filters.slip, filters.date]
  );
  const sum = (t: Reg["type"]) => rows.filter((r) => r.type === t && r.paymentStatus === "confirmed").reduce((a, r) => a + r.amount, 0);

  return (
    <div className="space-y-4">
      <UrlQuerySync onQuery={setQ} />
      <div>
        <h1 className="text-2xl font-display font-semibold text-stone-800">ลงทะเบียนศิษย์เก่าดีเด่น / ผู้สนับสนุนงาน</h1>
        <p className="text-sm text-stone-500 mt-1">ตรวจสลิปแล้วกด “อนุมัติ” เพื่อยืนยันการลงทะเบียน</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-white border border-cream-200 rounded-xl p-4">
          <div className="text-xs text-stone-500">ศิษย์เก่าดีเด่น (ยืนยันแล้ว)</div>
          <div className="text-xl font-semibold text-maroon-700">{sum("distinguished_alumni").toLocaleString("th-TH")} บาท</div>
        </div>
        <div className="bg-white border border-cream-200 rounded-xl p-4">
          <div className="text-xs text-stone-500">ผู้สนับสนุนงาน (ยืนยันแล้ว)</div>
          <div className="text-xl font-semibold text-maroon-700">{sum("sponsor").toLocaleString("th-TH")} บาท</div>
        </div>
      </div>

      <div className="flex gap-2 text-sm">
        {(["all", "distinguished_alumni", "sponsor"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg border ${filter === f ? "bg-maroon-700 border-maroon-700 text-white" : "bg-white border-stone-300 text-stone-700"}`}
          >
            {f === "all" ? "ทั้งหมด" : TYPE_LABEL[f]}
          </button>
        ))}
      </div>

      <AdminFilterBar
        search={{ value: q, onChange: setQ, placeholder: "ค้นหารหัส / ชื่อ / เบอร์โทร / อีเมล" }}
        filters={filters}
        statusOptions={buildStatusOptions(typeRows.map((r) => r.paymentStatus), STATUS_LABEL)}
        totalAll={typeRows.length}
        slipCounts={countSlipCategories(filterRows)}
        dateLabel="วันที่ลงทะเบียน"
        shown={shown.length}
        total={typeRows.length}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-stone-500">กำลังโหลด...</p>}
      {!loading && shown.length === 0 && <p className="text-stone-500">{q.trim() || filters.hasActive ? "ไม่พบรายการที่ตรงกับเงื่อนไขที่เลือก" : "ยังไม่มีรายการ"}</p>}

      <div className="space-y-3">
        {shown.map((r) => (
          <div key={r.id} className="bg-white border border-cream-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-start gap-3 sm:justify-between">
            <div className="space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold text-maroon-700">{r.code}</span>
                <span className="text-xs bg-cream-100 border border-cream-200 rounded-full px-2 py-0.5">{TYPE_LABEL[r.type]}</span>
                <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${STATUS_BADGE[r.paymentStatus] || ""}`}>
                  {STATUS_LABEL[r.paymentStatus] || r.paymentStatus}
                </span>
              </div>
              <div className="font-medium text-stone-800">{r.name}</div>
              {r.detail && <div className="text-stone-600">{r.detail}</div>}
              <div className="text-stone-500">
                {r.phone} · {r.email}
              </div>
              <div className="text-stone-400 text-xs">{new Date(r.createdAt).toLocaleString("th-TH")}</div>
              {r.easyslipMessage && r.easyslipStatus !== "SKIPPED" && <div className="text-xs text-stone-500">EasySlip: {r.easyslipMessage}</div>}
              {r.adminNote && <div className="text-xs text-stone-500">หมายเหตุ: {r.adminNote}</div>}
            </div>
            <div className="flex sm:flex-col items-center sm:items-end gap-2">
              <div className="text-lg font-semibold text-stone-800">{r.amount.toLocaleString("th-TH")} บาท</div>
              {supportReward(r.type, r.amount) && (
                <div className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  {supportReward(r.type, r.amount)}
                </div>
              )}
              {r.slipUrl && (
                <a href={r.slipUrl} target="_blank" rel="noreferrer" className="text-sm text-maroon-700 underline">
                  ดูสลิป
                </a>
              )}
              <EasySlipBadge status={r.easyslipStatus} message={r.easyslipMessage} />
              {r.paymentStatus === "awaiting_verify" && (
                <div className="flex gap-2">
                  <button disabled={busyId === r.id} onClick={() => act(r.id, "approve")} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-50">
                    อนุมัติ
                  </button>
                  <button disabled={busyId === r.id} onClick={() => act(r.id, "reject")} className="px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-600 text-sm disabled:opacity-50">
                    ปฏิเสธ
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
