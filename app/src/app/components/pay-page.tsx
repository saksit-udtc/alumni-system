"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteNav from "@/app/components/site-nav";
import PayQr from "@/app/components/pay-qr";
import { generatePromptPayPayload } from "@/lib/promptpay";

/**
 * หน้า "ชำระเงินและแนบสลิป" ใช้ร่วมกันทั้งจองโต๊ะและสั่งซื้อของที่ระลึก
 *
 * ฟอร์มจอง/สั่งซื้อสร้าง "ร่าง" (pending) ที่กันโต๊ะ/สินค้าไว้ก่อน แล้วพาลูกค้ามาที่หน้านี้
 * เพื่อสแกน QR จ่ายเงินและแนบสลิป ภายในเวลาที่กันไว้ (lib/holdPolicy.ts) — ลิงก์เดียวกันนี้อยู่ในอีเมล
 * "รอชำระเงิน" ด้วย ลูกค้าจึงกลับมาแนบสลิปทีหลังได้ถ้ายังไม่หมดเวลา
 */

const SLIP_MAX_BYTES = 10 * 1024 * 1024;
const CONTACT_NOTE = "คุณแพ็ททรียา เจียมสันต์ (แพตตี้) โทร. 064-319-1010";

type Kind = "reservation" | "merch";

type PayData = {
  status: string; // pending | awaiting_verify | confirmed | rejected | expired
  totalAmount: number;
  reservedUntil: string | null;
  title: string; // ชื่องาน/ร้านสำหรับรูป QR
  label: string; // บรรทัด "รายการ: ..."
  lines: string[]; // รายละเอียดที่แสดงในกล่องสรุป
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PayPage({ kind, code, initialPhone }: { kind: Kind; code: string; initialPhone: string }) {
  const router = useRouter();
  const isMerch = kind === "merch";

  const [phone, setPhone] = useState(initialPhone);
  const [phoneInput, setPhoneInput] = useState(initialPhone);
  const [data, setData] = useState<PayData | null>(null);
  const [loading, setLoading] = useState(!!initialPhone);
  const [loadError, setLoadError] = useState("");
  const [promptPayId, setPromptPayId] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<"" | "ok" | "late">("");

  const statusPageUrl = isMerch
    ? `/merch/status?orderCode=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`
    : `/status?bookingCode=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`;

  async function load(p: string) {
    setLoadError("");
    try {
      if (isMerch) {
        const res = await fetch(`/api/merch/orders/status?orderCode=${encodeURIComponent(code)}&phone=${encodeURIComponent(p)}`);
        const json = await res.json();
        if (!res.ok || !json.orders?.[0]) {
          setData(null);
          setLoadError(json.error || "ไม่พบข้อมูลการสั่งซื้อ หรือเบอร์โทรศัพท์ไม่ถูกต้อง");
          return;
        }
        const o = json.orders[0];
        setData({
          status: o.paymentStatus,
          totalAmount: Number(o.totalAmount),
          reservedUntil: o.reservedUntil ?? null,
          title: "ของที่ระลึก งานคืนสู่เหย้า วท.อุดรธานี",
          label: (o.items || [])
            .map((it: any) => `${it.productName}${it.size ? ` (${it.size})` : ""} x${it.quantity}`)
            .join(", "),
          lines: (o.items || []).map(
            (it: any) => `${it.productName}${it.size ? ` (ไซส์ ${it.size})` : ""} × ${it.quantity}`
          ),
        });
      } else {
        const res = await fetch(`/api/reservations/status?bookingCode=${encodeURIComponent(code)}&phone=${encodeURIComponent(p)}`);
        const json = await res.json();
        if (!res.ok || !json.reservations?.[0]) {
          setData(null);
          setLoadError(json.error || "ไม่พบข้อมูลการจอง หรือเบอร์โทรศัพท์ไม่ถูกต้อง");
          return;
        }
        const r = json.reservations[0];
        setData({
          status: r.paymentStatus,
          totalAmount: Number(r.totalAmount),
          reservedUntil: r.reservedUntil ?? null,
          title: r.eventName,
          label: `จองโต๊ะ ${r.tableNumber} — ${r.eventName}`,
          lines: [`โต๊ะหมายเลข ${r.tableNumber} · ${r.seatCount} ที่นั่ง`, r.eventName],
        });
      }
    } catch {
      setLoadError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (phone) load(phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  useEffect(() => {
    fetch("/api/settings/promptpay")
      .then((r) => r.json())
      .then((d) => setPromptPayId(d.promptPayId || ""))
      .catch(() => {});
  }, []);

  // นับถอยหลังทุกวินาที (เฉพาะตอนยังรอชำระเงิน) และโหลดสถานะใหม่ทันทีเมื่อหมดเวลา
  const deadline = data?.status === "pending" && data.reservedUntil ? new Date(data.reservedUntil).getTime() : null;
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  const remainingMs = deadline ? deadline - now : null;
  useEffect(() => {
    if (remainingMs !== null && remainingMs <= 0 && phone) {
      // ให้เซิร์ฟเวอร์คืนสต็อก/โต๊ะก่อน แล้วค่อยอ่านสถานะ (สถานะจริงเป็นของเซิร์ฟเวอร์)
      const t = setTimeout(() => load(phone), 3000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs !== null && remainingMs <= 0]);

  const payload = useMemo(() => {
    if (!promptPayId || !data || data.totalAmount <= 0) return null;
    try {
      return generatePromptPayPayload(promptPayId, data.totalAmount);
    } catch {
      return null;
    }
  }, [promptPayId, data]);

  useEffect(() => {
    setPreviewFailed(false);
    if (!file || !file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function fileError(): string {
    if (!file) return "กรุณาแนบไฟล์สลิปโอนเงิน";
    if (file.type && !file.type.startsWith("image/") && file.type !== "application/pdf") return "รองรับเฉพาะไฟล์รูปภาพหรือ PDF เท่านั้น";
    if (file.size === 0) return "ไฟล์ว่างเปล่า กรุณาเลือกไฟล์สลิปใหม่";
    if (file.size > SLIP_MAX_BYTES) return `ไฟล์ใหญ่เกินไป (${formatFileSize(file.size)}) ขนาดต้องไม่เกิน 10 MB`;
    return "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = fileError();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("bookerPhone", phone);
      formData.append("file", file as File);
      const url = isMerch
        ? `/api/merch/orders/${encodeURIComponent(code)}/upload-slip`
        : `/api/reservations/${encodeURIComponent(code)}/upload-slip`;
      const res = await fetch(url, { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "เกิดข้อผิดพลาด");
        return;
      }
      setResult(json.late ? "late" : "ok");
    } finally {
      setSubmitting(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <div>
      <SiteNav />
      <main className="max-w-md mx-auto p-4 space-y-3">{children}</main>
    </div>
  );

  // ยังไม่มีเบอร์ (เปิดลิงก์ที่ไม่มี ?phone=) — ขอเบอร์เพื่อยืนยันตัวตน (รหัส + เบอร์ เป็นคู่ความลับ)
  if (!phone) {
    return shell(
      <>
        <h1 className="text-2xl font-display font-semibold text-stone-800">ชำระเงินและแนบสลิป</h1>
        <p className="text-sm text-stone-500">รหัส{isMerch ? "การสั่งซื้อ" : "การจอง"}: {code}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (phoneInput.trim()) {
              setLoading(true);
              setPhone(phoneInput.trim());
            }
          }}
          className="flex flex-col gap-3 bg-white p-5 rounded-xl border border-cream-200 shadow-md"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-stone-700">เบอร์โทรศัพท์ที่ใช้{isMerch ? "สั่งซื้อ" : "จอง"} *</span>
            <input
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
              required
            />
          </label>
          <button type="submit" className="bg-maroon-700 hover:bg-maroon-800 text-white rounded-lg py-2.5 font-semibold">
            ดำเนินการต่อ
          </button>
        </form>
      </>
    );
  }

  if (loading) return shell(<p className="text-center text-stone-500 py-10">กำลังโหลด...</p>);

  if (!data) {
    return shell(
      <div className="bg-white border border-cream-200 rounded-xl shadow-md p-6 text-center space-y-3">
        <p className="text-red-600">{loadError || "ไม่พบข้อมูล"}</p>
        <button onClick={() => setPhone("")} className="text-sm text-maroon-700 underline">ใส่เบอร์โทรศัพท์ใหม่</button>
      </div>
    );
  }

  if (result) {
    return shell(
      <div className="bg-white border border-cream-200 rounded-xl shadow-md p-6 text-center space-y-3">
        <h1 className={`text-xl font-display font-semibold ${result === "ok" ? "text-emerald-600" : "text-amber-700"}`}>
          {result === "ok" ? "ส่งสลิปสำเร็จ" : "ได้รับสลิปแล้ว (หลังหมดเวลากันรายการ)"}
        </h1>
        <p className="text-stone-600">รหัส{isMerch ? "การสั่งซื้อ" : "การจอง"}ของท่านคือ {code}</p>
        {result === "ok" ? (
          <p className="text-sm text-stone-500">เจ้าหน้าที่จะตรวจสอบสลิปการโอนเงินโดยเร็วที่สุด ท่านตรวจสอบสถานะได้ที่หน้าสถานะ</p>
        ) : (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            รายการนี้หมดเวลากัน{isMerch ? "สินค้า" : "โต๊ะ"}ไปแล้ว ระบบเก็บสลิปของท่านไว้ให้เจ้าหน้าที่ตรวจสอบและจะติดต่อกลับ
            หากต้องการสอบถามเพิ่มเติม ติดต่อ {CONTACT_NOTE}
          </p>
        )}
        <button
          onClick={() => router.push(statusPageUrl)}
          className="bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg px-4 py-2 font-medium"
        >
          เช็คสถานะ{isMerch ? "การสั่งซื้อ" : "การจอง"}
        </button>
      </div>
    );
  }

  const status = data.status;
  const canPay = status === "pending" || status === "awaiting_verify";
  const isExpired = status === "expired";
  const timeUp = remainingMs !== null && remainingMs <= 0;

  return shell(
    <>
      <h1 className="text-2xl font-display font-semibold text-stone-800">ชำระเงินและแนบสลิป</h1>
      <p className="text-sm text-stone-500">รหัส{isMerch ? "การสั่งซื้อ" : "การจอง"}: {code}</p>

      <div className="bg-white border border-cream-200 rounded-xl shadow-md p-4 space-y-1">
        {data.lines.map((l, i) => (
          <p key={i} className="text-sm text-stone-600">{l}</p>
        ))}
        <p className="text-sm font-medium text-stone-800 pt-1">ยอดชำระ: {data.totalAmount.toLocaleString("th-TH")} บาท</p>
      </div>

      {status === "pending" && remainingMs !== null && !timeUp && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${remainingMs < 5 * 60 * 1000 ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          กัน{isMerch ? "สินค้า" : "โต๊ะ"}ไว้ให้อีก <span className="font-mono font-semibold">{formatCountdown(remainingMs)}</span> นาที
          — กรุณาชำระเงินและแนบสลิปภายในเวลานี้ ระบบส่งลิงก์หน้านี้ไปที่อีเมลของท่านแล้วด้วย
        </div>
      )}
      {status === "pending" && timeUp && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          หมดเวลากัน{isMerch ? "สินค้า" : "โต๊ะ"}แล้ว กำลังตรวจสอบสถานะ...
        </div>
      )}
      {status === "awaiting_verify" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ท่านส่งสลิปแล้ว เจ้าหน้าที่กำลังตรวจสอบ หากต้องการแนบสลิปใหม่ สามารถอัปโหลดด้านล่างได้
        </div>
      )}
      {isExpired && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 space-y-1">
          <p>
            รายการนี้หมดเวลากัน{isMerch ? "สินค้า" : "โต๊ะ"}แล้ว{isMerch ? " สินค้าถูกคืนเข้าสต็อก" : " โต๊ะถูกปล่อยให้ผู้อื่นแล้ว"}
          </p>
          <p>
            หากท่านโอนเงินไปแล้ว กรุณาแนบสลิปด้านล่าง เจ้าหน้าที่จะตรวจสอบและติดต่อกลับ หรือติดต่อ {CONTACT_NOTE}
          </p>
        </div>
      )}
      {status === "confirmed" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ชำระเงินและยืนยันเรียบร้อยแล้ว <Link href={statusPageUrl} className="underline">ดูสถานะ</Link>
        </div>
      )}
      {status === "rejected" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          รายการนี้ถูกปฏิเสธ กรุณาติดต่อ {CONTACT_NOTE}
        </div>
      )}

      {(canPay || isExpired) && payload && status !== "awaiting_verify" && (
        <PayQr value={payload} amount={data.totalAmount} label={data.label} title={data.title} size={180} />
      )}

      {(canPay || isExpired) && (
        <form onSubmit={submit} className="flex flex-col gap-3 bg-white p-5 rounded-xl border border-cream-200 shadow-md">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-stone-700">ไฟล์สลิปโอนเงิน *</span>
            <span className="text-xs text-stone-400">โอนตามยอดด้านบนแล้วแนบรูปสลิปที่นี่ ตรวจให้แน่ใจว่าเห็นยอดเงินและวันที่ชัดเจน</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setError("");
              }}
              className="border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </label>

          {file && (
            <div className="flex items-start gap-3 rounded-lg border border-cream-200 bg-cream-50 p-2">
              {previewUrl && !previewFailed ? (
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" title="คลิกเพื่อดูรูปขนาดเต็ม" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="ตัวอย่างสลิปที่เลือก"
                    onError={() => setPreviewFailed(true)}
                    className="h-40 w-auto max-w-[9rem] rounded border border-stone-200 bg-white object-contain"
                  />
                </a>
              ) : (
                <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded border border-stone-200 bg-white text-xs font-semibold text-stone-500">
                  {file.type === "application/pdf" ? "PDF" : "ไฟล์"}
                </div>
              )}
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium text-stone-700" title={file.name}>{file.name}</p>
                <p className="text-xs text-stone-500">{formatFileSize(file.size)}</p>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                  className="mt-1 text-xs text-red-600 underline hover:text-red-700"
                >
                  ลบไฟล์
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg py-2.5 font-semibold disabled:opacity-50"
          >
            {submitting ? "กำลังอัปโหลด..." : "ส่งสลิป"}
          </button>
        </form>
      )}
    </>
  );
}
