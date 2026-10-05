"use client";

import { useEffect, useState } from "react";

type LogEntry = {
  id: string;
  actorType: string;
  admin: { username: string } | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  path: string | null;
  createdAt: string;
};

type EmailLogEntry = {
  id: string;
  type: string;
  recipient: string;
  status: string;
  error: string | null;
  ref?: string | null;
  createdAt: string;
};

const RESENDABLE_TYPES = [
  "CONFIRMATION",
  "BOOKING_RECEIVED",
  "SLIP_RECEIVED",
  "MERCH_ORDER_CONFIRMED",
  "MERCH_ORDER_RECEIVED",
  "MERCH_SLIP_RECEIVED",
];

const EMAIL_TYPE_LABELS: Record<string, string> = {
  CONFIRMATION: "ยืนยันการจอง (พร้อม QR)",
  BOOKING_RECEIVED: "รับการจองแล้ว",
  SLIP_RECEIVED: "ได้รับสลิปการจอง",
  MERCH_ORDER_CONFIRMED: "ยืนยันคำสั่งซื้อของที่ระลึก",
  MERCH_ORDER_RECEIVED: "รับคำสั่งซื้อของที่ระลึก",
  MERCH_SLIP_RECEIVED: "ได้รับสลิปคำสั่งซื้อ",
};

const ACTION_LABELS: Record<string, string> = {
  RESERVATION_APPROVE: "อนุมัติการจอง",
  RESERVATION_REJECT: "ปฏิเสธการจอง",
  RESERVATION_UNCONFIRM: "ยกเลิกการยืนยัน",
  RESERVATION_CHECKIN: "เช็คอิน",
  RESERVATION_SOUVENIR_GIVE: "มอบของที่ระลึก",
  RESERVATION_SOUVENIR_UNDO: "ยกเลิกการมอบของที่ระลึก",
  MERCH_ORDER_APPROVE: "อนุมัติคำสั่งซื้อ",
  MERCH_ORDER_REJECT: "ปฏิเสธคำสั่งซื้อ",
  MERCH_ORDER_EDIT_ADDRESS: "แก้ไขที่อยู่จัดส่ง",
  ADMIN_USER_CREATE: "สร้างบัญชีผู้ใช้งาน",
  ADMIN_USER_UPDATE: "แก้ไขบัญชีผู้ใช้งาน",
  EMAIL_RESEND: "ส่งอีเมลซ้ำ / แก้อีเมลผู้รับ",
  PAGE_VIEW: "เปิดดูหน้าเว็บ (สาธารณะ)",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export default function AuditLogPage() {
  const [tab, setTab] = useState<"ADMIN" | "PUBLIC" | "EMAIL">("ADMIN");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendBusyId, setResendBusyId] = useState<string | null>(null);
  const [editEmailId, setEditEmailId] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [resendMsg, setResendMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  function loadEmailLogs() {
    return fetch(`/api/admin/email-log?take=100`)
      .then((r) => (r.ok ? r.json() : { logs: [] }))
      .then((data) => setEmailLogs(data.logs || []));
  }

  async function resendEmail(log: EmailLogEntry, email?: string) {
    setResendBusyId(log.id);
    setResendMsg(null);
    try {
      const res = await fetch(`/api/admin/email-log/${log.id}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(email ? { email } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResendMsg({ id: log.id, ok: false, text: data.error || "ส่งอีเมลไม่สำเร็จ" });
        return;
      }
      setResendMsg({
        id: log.id,
        ok: !!data.sent,
        text: data.sent
          ? `ส่งอีเมลไปที่ ${data.recipient} แล้ว`
          : `ส่งไม่สำเร็จ${data.error ? `: ${data.error}` : ""}`,
      });
      if (data.sent) setEditEmailId(null);
      await loadEmailLogs();
    } finally {
      setResendBusyId(null);
    }
  }

  useEffect(() => {
    setLoading(true);
    if (tab === "EMAIL") {
      fetch(`/api/admin/email-log?take=100`)
        .then((r) => (r.ok ? r.json() : { logs: [] }))
        .then((data) => setEmailLogs(data.logs || []))
        .finally(() => setLoading(false));
      return;
    }
    fetch(`/api/admin/audit-log?actorType=${tab}&take=100`)
      .then((r) => (r.ok ? r.json() : { logs: [] }))
      .then((data) => setLogs(data.logs || []))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-stone-800 mb-1">บันทึกการใช้งาน (Audit Log)</h1>
      <p className="text-sm text-stone-500 mb-4">
        ประวัติการกระทำของแอดมิน และการเปิดดูหน้าเว็บฝั่งสาธารณะ (ไม่ระบุตัวตนผู้เข้าชม — เก็บเฉพาะหน้าและเวลา)
      </p>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("ADMIN")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "ADMIN" ? "bg-maroon-700 text-white" : "bg-white border border-cream-200 text-stone-600"}`}
        >
          การกระทำของแอดมิน
        </button>
        <button
          onClick={() => setTab("PUBLIC")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "PUBLIC" ? "bg-maroon-700 text-white" : "bg-white border border-cream-200 text-stone-600"}`}
        >
          การเข้าชมสาธารณะ
        </button>
        <button
          onClick={() => setTab("EMAIL")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "EMAIL" ? "bg-maroon-700 text-white" : "bg-white border border-cream-200 text-stone-600"}`}
        >
          สถานะการส่งอีเมล
        </button>
      </div>

      <div className="bg-white border border-cream-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-cream-50 text-stone-500">
            <tr>
              <th className="text-left px-3 py-2">เวลา</th>
              {tab === "ADMIN" ? (
                <>
                  <th className="text-left px-3 py-2">แอดมิน</th>
                  <th className="text-left px-3 py-2">การกระทำ</th>
                  <th className="text-left px-3 py-2">รายละเอียด</th>
                </>
              ) : tab === "PUBLIC" ? (
                <th className="text-left px-3 py-2">หน้าเว็บ</th>
              ) : (
                <>
                  <th className="text-left px-3 py-2">ผู้รับ</th>
                  <th className="text-left px-3 py-2">ประเภทอีเมล</th>
                  <th className="text-left px-3 py-2">สถานะ</th>
                  <th className="text-left px-3 py-2">ข้อผิดพลาด</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-6 text-center text-stone-400" colSpan={5}>กำลังโหลด...</td></tr>
            ) : tab === "EMAIL" ? (
              emailLogs.length === 0 ? (
                <tr><td className="px-3 py-6 text-center text-stone-400" colSpan={5}>ยังไม่มีข้อมูล</td></tr>
              ) : (
                emailLogs.map((log) => (
                  <tr key={log.id} className="border-t border-cream-100">
                    <td className="px-3 py-2 whitespace-nowrap text-stone-500">{formatDate(log.createdAt)}</td>
                    <td className="px-3 py-2">{log.recipient}</td>
                    <td className="px-3 py-2">{EMAIL_TYPE_LABELS[log.type] || log.type}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${log.status === "SUCCESS" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {log.status === "SUCCESS" ? "สำเร็จ" : "ล้มเหลว"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-stone-500 max-w-xs">
                      <div className="truncate" title={log.error || ""}>{log.error || "-"}</div>
                      {log.status === "FAILED" && RESENDABLE_TYPES.includes(log.type) && (
                        <div className="mt-1 space-y-1">
                          {editEmailId === log.id ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <input
                                type="email"
                                value={emailDraft}
                                onChange={(e) => setEmailDraft(e.target.value)}
                                placeholder="อีเมลที่ถูกต้อง"
                                className="px-2 py-1 border border-cream-200 rounded-md text-xs w-56"
                              />
                              <button
                                onClick={() => resendEmail(log, emailDraft)}
                                disabled={resendBusyId === log.id || !emailDraft.trim()}
                                className="px-2 py-1 rounded-md bg-maroon-700 text-white text-xs disabled:opacity-50"
                              >
                                บันทึกอีเมลและส่ง
                              </button>
                              <button
                                onClick={() => setEditEmailId(null)}
                                className="px-2 py-1 rounded-md text-xs text-stone-500 hover:underline"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                onClick={() => resendEmail(log)}
                                disabled={resendBusyId === log.id}
                                className="px-2 py-1 rounded-md bg-stone-100 text-stone-700 text-xs hover:bg-stone-200 disabled:opacity-50"
                              >
                                {resendBusyId === log.id ? "กำลังส่ง..." : "ส่งซ้ำ"}
                              </button>
                              <button
                                onClick={() => {
                                  setEditEmailId(log.id);
                                  setEmailDraft(log.recipient);
                                  setResendMsg(null);
                                }}
                                className="px-2 py-1 rounded-md text-xs text-maroon-700 hover:underline"
                              >
                                แก้อีเมลแล้วส่ง
                              </button>
                            </div>
                          )}
                          {resendMsg?.id === log.id && (
                            <div className={`text-xs ${resendMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{resendMsg.text}</div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )
            ) : logs.length === 0 ? (
              <tr><td className="px-3 py-6 text-center text-stone-400" colSpan={4}>ยังไม่มีข้อมูล</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-t border-cream-100">
                  <td className="px-3 py-2 whitespace-nowrap text-stone-500">{formatDate(log.createdAt)}</td>
                  {tab === "ADMIN" ? (
                    <>
                      <td className="px-3 py-2">{log.admin?.username || "-"}</td>
                      <td className="px-3 py-2">{ACTION_LABELS[log.action] || log.action}</td>
                      <td className="px-3 py-2 text-stone-500">{log.detail || "-"}</td>
                    </>
                  ) : (
                    <td className="px-3 py-2 font-mono text-xs">{log.path}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
