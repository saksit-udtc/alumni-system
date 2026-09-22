"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminStatCard } from "@/app/components/admin-stat-card";
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

const STATUS_LABEL: Record<string, string> = {
  pending: "รอชำระเงิน",
  awaiting_verify: "รอตรวจสอบสลิป",
  confirmed: "ยืนยันแล้ว",
  rejected: "ปฏิเสธ",
  expired: "หมดเวลา",
};
const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  awaiting_verify: "bg-amber-50 text-amber-700 border border-amber-200",
  confirmed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
  expired: "bg-stone-100 text-stone-500 border border-stone-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap ${
        STATUS_BADGE[status] || "bg-stone-100 text-stone-500 border border-stone-200"
      }`}
    >
      {STATUS_LABEL[status] || status}
    </span>
  );
}

// EasySlip's automated check, shown next to "ดูสลิป" — purely advisory, the
// admin can still approve regardless of this badge (see lib/easyslip.ts).
function EasySlipBadge({ status, message }: { status: string | null; message: string | null }) {
  if (!status || status === "SKIPPED") return null;
  const style =
    status === "MATCH"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
      : "bg-red-50 text-red-700 border border-red-200"; // ERROR, AMOUNT_MISMATCH, INVALID_SLIP, DUPLICATE
  const label = status === "MATCH" ? "✓ ตรงกับธนาคาร" : status === "ERROR" ? "ตรวจสอบไม่สำเร็จ" : "⚠ ไม่ตรง/น่าสงสัย";
  return (
    <span title={message || ""} className={`inline-block whitespace-nowrap mt-1.5 text-[11px] px-2 py-0.5 rounded-lg font-medium w-fit ${style}`}>
      {label}
    </span>
  );
}

export default function AdminMerchOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  // Shipment tracking (EMS) state
  const [trackDraft, setTrackDraft] = useState<Record<string, string>>({});
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [shipBusyId, setShipBusyId] = useState<string | null>(null);
  const [shipMsg, setShipMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const [shipFilter, setShipFilter] = useState<"all" | "toship" | "shipped">("all");
  const [q, setQ] = useState("");
  const filters = useListFilters();

  function load() {
    fetch("/api/admin/merch/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []));
  }
  useEffect(load, []);

  async function act(orderId: string, action: "approve" | "reject", note?: string) {
    setBusyId(orderId);
    try {
      await fetch(`/api/admin/merch/orders/${orderId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  }

  function startEditAddress(orderId: string, currentAddress: string) {
    setEditingId(orderId);
    setEditValue(currentAddress);
  }

  function cancelEditAddress() {
    setEditingId(null);
    setEditValue("");
  }

  async function saveAddress(orderId: string) {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/merch/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingAddress: editValue }),
      });
      if (res.ok) {
        setEditingId(null);
        setEditValue("");
        load();
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function saveTracking(orderId: string) {
    setShipBusyId(orderId);
    setShipMsg(null);
    try {
      const res = await fetch(`/api/admin/merch/orders/${orderId}/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumber: trackDraft[orderId] || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setShipMsg({ id: orderId, ok: false, text: data.error || "บันทึกเลขพัสดุไม่สำเร็จ" });
        return;
      }
      setEditingTrackId(null);
      setShipMsg({
        id: orderId,
        ok: data.emailSent,
        text: data.emailSent
          ? "บันทึกเลขพัสดุและส่งอีเมลแจ้งผู้สั่งแล้ว"
          : "บันทึกเลขพัสดุแล้ว แต่ส่งอีเมลไม่สำเร็จ — กด \"ส่งอีเมลอีกครั้ง\"",
      });
      load();
    } finally {
      setShipBusyId(null);
    }
  }

  async function resendShippedEmail(orderId: string) {
    setShipBusyId(orderId);
    setShipMsg(null);
    try {
      const res = await fetch(`/api/admin/merch/orders/${orderId}/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resendEmail: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setShipMsg({ id: orderId, ok: false, text: data.error || "ส่งอีเมลไม่สำเร็จ" });
        return;
      }
      setShipMsg({
        id: orderId,
        ok: data.emailSent,
        text: data.emailSent ? "ส่งอีเมลแจ้งจัดส่งอีกครั้งแล้ว" : "ส่งอีเมลไม่สำเร็จ (ตรวจสอบการตั้งค่าอีเมลของระบบ)",
      });
      load();
    } finally {
      setShipBusyId(null);
    }
  }

  const pendingCount = orders.filter((o) => ["pending", "awaiting_verify"].includes(o.paymentStatus)).length;
  const confirmedOrders = orders.filter((o) => o.paymentStatus === "confirmed");
  const confirmedRevenue = confirmedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const toShipCount = confirmedOrders.filter((o) => !o.trackingNumber).length;
  const shippedCount = confirmedOrders.filter((o) => o.trackingNumber).length;
  const filterRows: FilterableRow[] = orders.map((o) => ({
    status: o.paymentStatus,
    slip: slipCategory(!!o.latestSlipUrl, o.latestSlipEasyslipStatus),
    createdAt: o.createdAt,
  }));
  const visibleOrders = orders.filter((o, i) => {
    if (!matchesQuery(q, [o.orderCode, o.bookerName, o.bookerPhone, o.bookerEmail, o.trackingNumber])) return false;
    if (!matchesListFilters(filters, filterRows[i])) return false;
    if (shipFilter === "toship") return o.paymentStatus === "confirmed" && !o.trackingNumber;
    if (shipFilter === "shipped") return !!o.trackingNumber;
    return true;
  });

  return (
    <div className="space-y-6">
      <UrlQuerySync onQuery={setQ} />
      {/* ?ship=toship|shipped จากกระดิ่งแจ้งเตือน → เลือกตัวกรองการจัดส่งให้เลย */}
      <UrlQuerySync param="ship" onQuery={(v) => { if (v === "toship" || v === "shipped") setShipFilter(v); }} />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">รายการสั่งซื้อของที่ระลึก</h1>
          <p className="text-sm text-stone-500 mt-0.5">ตรวจสอบสลิปและอนุมัติคำสั่งซื้อของที่ระลึกทั้งหมด</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/merch/orders/print"
            className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors"
          >
            ปริ้นที่อยู่จัดส่ง
          </Link>
          <a
            href="/api/admin/merch/orders/export"
            className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors"
          >
            Export Excel
          </a>
          <Link href="/admin/merch/products" className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors">
            จัดการสินค้า
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <AdminStatCard icon="bag" label="คำสั่งซื้อทั้งหมด" value={String(orders.length)} tone="violet" />
        <AdminStatCard icon="clock" label="รอตรวจสอบ" value={String(pendingCount)} tone="amber" />
        <AdminStatCard icon="checkin" label="ยืนยันแล้ว" value={String(confirmedOrders.length)} tone="emerald" />
        <AdminStatCard icon="coin" label="ยอดขายยืนยันแล้ว" value={`${confirmedRevenue.toLocaleString()} บาท`} tone="sky" />
      </div>

      <AdminFilterBar
        search={{ value: q, onChange: setQ, placeholder: "ค้นหารหัสออเดอร์ / ชื่อ / เบอร์โทร / เลขพัสดุ" }}
        filters={filters}
        statusOptions={buildStatusOptions(orders.map((o) => o.paymentStatus), STATUS_LABEL)}
        totalAll={orders.length}
        slipCounts={countSlipCategories(filterRows)}
        dateLabel="วันที่สั่งซื้อ"
        shown={visibleOrders.length}
        total={orders.length}
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-stone-500">การจัดส่ง:</span>
        {([
          ["all", `ทั้งหมด (${orders.length})`],
          ["toship", `รอจัดส่ง (${toShipCount})`],
          ["shipped", `จัดส่งแล้ว (${shippedCount})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setShipFilter(key)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              shipFilter === key
                ? "bg-primary-700 text-white border-primary-700"
                : "bg-white text-stone-600 border-stone-300 hover:bg-cream-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-cream-200 p-10 text-center text-stone-400 text-sm">
          ยังไม่มีคำสั่งซื้อของที่ระลึกเข้ามาในระบบ
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-cream-200 p-10 text-center text-stone-400 text-sm">
          ไม่มีคำสั่งซื้อที่ตรงกับเงื่อนไขที่เลือก
        </div>
      ) : (
        <div className="space-y-4">
          {visibleOrders.map((o) => (
            <div key={o.id} className="bg-white rounded-2xl border border-cream-200/80 shadow-sm overflow-hidden">
              {/* หัวการ์ด: รหัส / สถานะ / วันที่ / ยอดรวม */}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 bg-gradient-to-b from-cream-100 to-cream-50 border-b border-cream-200/80">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs bg-white text-stone-600 border border-stone-200 px-2 py-1 rounded-md">{o.orderCode}</span>
                  <StatusBadge status={o.paymentStatus} />
                  <span className="text-xs text-stone-400">
                    {new Date(o.createdAt).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="text-stone-800 font-semibold tabular-nums">{Number(o.totalAmount).toLocaleString()} บาท</div>
              </div>

              <div className="grid gap-x-6 gap-y-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                {/* ผู้สั่ง + ที่อยู่ */}
                <div className="min-w-0 space-y-2 text-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">ผู้สั่งและที่อยู่จัดส่ง</div>
                  <div>
                    <div className="font-medium text-stone-800">{o.bookerName}</div>
                    <div className="text-xs text-stone-500">{o.bookerPhone}</div>
                    <div className="text-xs text-stone-500 break-all">{o.bookerEmail}</div>
                  </div>
                  {editingId === o.id ? (
                    <div className="space-y-1.5">
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        rows={4}
                        className="w-full text-xs border border-stone-300 rounded-md p-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => saveAddress(o.id)}
                          disabled={savingEdit || !editValue.trim()}
                          className="text-xs px-2 py-1 rounded-md bg-primary-700 text-white hover:bg-primary-800 transition-colors disabled:opacity-50"
                        >
                          บันทึก
                        </button>
                        <button
                          onClick={cancelEditAddress}
                          disabled={savingEdit}
                          className="text-xs px-2 py-1 rounded-md bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-stone-600 bg-cream-50/70 border border-cream-200 rounded-lg p-2.5 space-y-1">
                      <div className="whitespace-pre-wrap break-words">{o.shippingAddress}</div>
                      <button
                        onClick={() => startEditAddress(o.id, o.shippingAddress)}
                        className="text-primary-700 hover:text-primary-800 hover:underline"
                      >
                        แก้ไขที่อยู่
                      </button>
                    </div>
                  )}
                </div>

                {/* รายการสินค้า + สลิป */}
                <div className="min-w-0 space-y-2 text-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">รายการสินค้า</div>
                  <div className="space-y-0.5">
                    {o.items.map((it: any, i: number) => (
                      <div key={i} className="text-xs text-stone-600">
                        {it.productName}
                        {it.size ? ` (${it.size})` : ""} × {it.quantity}
                      </div>
                    ))}
                  </div>
                  <div className="pt-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">สลิปโอนเงิน</div>
                    <div className="flex flex-col items-start">
                      {o.latestSlipUrl ? (
                        <a
                          href={o.latestSlipUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block whitespace-nowrap text-xs px-2.5 py-1.5 rounded-lg font-medium bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-colors"
                        >
                          ดูสลิป
                        </a>
                      ) : (
                        <span className="inline-block whitespace-nowrap text-xs px-2.5 py-1.5 rounded-lg font-medium bg-stone-100 text-stone-400 border border-stone-200">ไม่มีสลิป</span>
                      )}
                      <EasySlipBadge status={o.latestSlipEasyslipStatus} message={o.latestSlipEasyslipMessage} />
                    </div>
                  </div>
                </div>

                {/* การจัดส่ง EMS */}
                <div className="min-w-0 space-y-2 text-sm md:col-span-2 xl:col-span-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">การจัดส่ง (EMS)</div>
                  {o.paymentStatus !== "confirmed" ? (
                    <p className="text-xs text-stone-400">จะกรอกเลขพัสดุได้หลังยืนยันการชำระเงินแล้ว</p>
                  ) : o.trackingNumber && editingTrackId !== o.id ? (
                    <div className="space-y-1.5 text-xs">
                      <a
                        href={`https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(o.trackingNumber)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-sm text-sky-700 hover:underline break-all"
                      >
                        {o.trackingNumber}
                      </a>
                      <div className="text-stone-400">
                        ส่งเมื่อ {new Date(o.shippedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                      {o.shipmentEmailSentAt ? (
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ✓ ส่งอีเมลแล้ว
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                          ⚠ ยังไม่ได้ส่งอีเมล
                        </span>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => resendShippedEmail(o.id)}
                          disabled={shipBusyId === o.id}
                          className="px-2 py-1 rounded-md bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors disabled:opacity-50"
                        >
                          ส่งอีเมลอีกครั้ง
                        </button>
                        <button
                          onClick={() => {
                            setEditingTrackId(o.id);
                            setTrackDraft((d) => ({ ...d, [o.id]: o.trackingNumber }));
                            setShipMsg(null);
                          }}
                          className="px-2 py-1 rounded-md text-primary-700 hover:underline"
                        >
                          แก้เลข
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveTracking(o.id);
                      }}
                      className="space-y-1.5"
                    >
                      <input
                        value={trackDraft[o.id] ?? ""}
                        onChange={(e) => setTrackDraft((d) => ({ ...d, [o.id]: e.target.value.toUpperCase() }))}
                        placeholder="EE123456789TH"
                        maxLength={20}
                        className="w-full font-mono text-xs border border-stone-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="submit"
                          disabled={shipBusyId === o.id || !(trackDraft[o.id] || "").trim()}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-primary-700 text-white hover:bg-primary-800 transition-colors font-medium disabled:opacity-50"
                        >
                          บันทึกและส่งอีเมล
                        </button>
                        {editingTrackId === o.id && (
                          <button
                            type="button"
                            onClick={() => setEditingTrackId(null)}
                            className="text-xs px-2 py-1 rounded-md bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                          >
                            ยกเลิก
                          </button>
                        )}
                      </div>
                    </form>
                  )}
                  {shipMsg && shipMsg.id === o.id ? (
                    <p className={`text-xs ${shipMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{shipMsg.text}</p>
                  ) : null}
                </div>
              </div>

              {/* ปุ่มอนุมัติ/ปฏิเสธ — แสดงเฉพาะรายการที่รอตรวจสลิป */}
              {["pending", "awaiting_verify"].includes(o.paymentStatus) && (
                <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3 border-t border-cream-100 bg-cream-50/50">
                  <button
                    onClick={() => {
                              const n = window.prompt("เหตุผลที่ปฏิเสธ (ไม่บังคับ) — ระบบจะส่งอีเมลแจ้งเหตุผลนี้ให้ลูกค้า");
                              if (n === null) return;
                              act(o.id, "reject", n);
                            }}
                    disabled={busyId === o.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors font-medium disabled:opacity-50"
                  >
                    ปฏิเสธ
                  </button>
                  <button
                    onClick={() => act(o.id, "approve")}
                    disabled={busyId === o.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors font-medium disabled:opacity-50"
                  >
                    อนุมัติ
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
