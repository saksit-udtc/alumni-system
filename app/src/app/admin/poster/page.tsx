"use client";

import { useEffect, useRef, useState } from "react";

interface PosterInfo {
  enabled: boolean;
  imageUrl: string;
  isDefault: boolean;
}

// จัดการโปสเตอร์งานที่แสดงบนหน้าแรก (ต่อจากการ์ดเมนู ก่อนส่วนนับถอยหลัง)
export default function AdminPosterPage() {
  const [info, setInfo] = useState<PosterInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch("/api/admin/poster");
    if (res.status === 401) {
      window.location.href = "/admin/login?next=/admin/poster";
      return;
    }
    if (res.ok) setInfo(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  // ตัวอย่างภาพก่อนอัปโหลด
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function call(init: RequestInit, okMsg: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/poster", init);
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = "/admin/login?next=/admin/poster";
        return false;
      }
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return false;
      }
      setInfo(data);
      setNotice(okMsg);
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("กรุณาเลือกไฟล์รูปโปสเตอร์");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    const ok = await call({ method: "POST", body: fd }, "อัปโหลดโปสเตอร์ใหม่แล้ว หน้าแรกจะแสดงภาพนี้ทันที");
    if (ok) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function toggle() {
    if (!info) return;
    call(
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !info.enabled }) },
      info.enabled ? "ซ่อนโปสเตอร์จากหน้าแรกแล้ว" : "แสดงโปสเตอร์บนหน้าแรกแล้ว",
    );
  }

  function reset() {
    if (!confirm("ยืนยันกลับไปใช้โปสเตอร์เริ่มต้น? (ไฟล์ที่อัปโหลดไว้จะถูกลบ)")) return;
    call({ method: "DELETE" }, "กลับไปใช้โปสเตอร์เริ่มต้นแล้ว");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-stone-800">โปสเตอร์งาน</h1>
        <p className="text-sm text-stone-500 mt-1">
          โปสเตอร์ที่แสดงบนหน้าแรก ต่อจากการ์ดเมนู 4 ใบ (กว้างเท่าสไลด์) แตะเพื่อขยายดูเต็มจอได้ และมีปุ่มดาวน์โหลดสำหรับแชร์ใน LINE
          ภาพนี้ใช้เป็นรูปตัวอย่างตอนแชร์ลิงก์เว็บด้วย
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr] items-start">
        <div className="bg-white rounded-xl border border-cream-200 shadow-md p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-stone-800">โปสเตอร์ที่ใช้งานอยู่</h2>
            {info && (
              <span className={`text-xs rounded-full px-2 py-0.5 border ${info.enabled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-stone-100 text-stone-500 border-stone-200"}`}>
                {info.enabled ? "แสดงบนหน้าแรก" : "ซ่อนอยู่"}
              </span>
            )}
          </div>
          {info ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={info.imageUrl} alt="โปสเตอร์งาน" className={`w-full rounded-lg border border-stone-200 ${info.enabled ? "" : "opacity-50"}`} />
          ) : (
            <div className="h-64 rounded-lg bg-stone-100 animate-pulse" />
          )}
          {info?.isDefault && <p className="text-xs text-stone-500">กำลังใช้ภาพเริ่มต้นที่มากับระบบ (ยังไม่เคยอัปโหลด)</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={toggle} disabled={busy || !info} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-50">
              {info?.enabled ? "ซ่อนจากหน้าแรก" : "แสดงบนหน้าแรก"}
            </button>
            {info && !info.isDefault && (
              <button type="button" onClick={reset} disabled={busy} className="rounded-lg border border-red-200 text-red-600 px-3 py-1.5 text-sm hover:bg-red-50 disabled:opacity-50">
                กลับไปใช้ภาพเริ่มต้น
              </button>
            )}
          </div>
        </div>

        <form onSubmit={upload} className="bg-white rounded-xl border border-cream-200 shadow-md p-4 space-y-3">
          <h2 className="font-semibold text-stone-800">อัปโหลดโปสเตอร์ใหม่</h2>
          <p className="text-sm text-stone-500">
            รองรับ JPEG, PNG, WEBP ขนาดไม่เกิน 10MB แนะนำภาพแนวตั้งความละเอียดสูง (เช่น กว้างอย่างน้อย 1080px) เพื่อให้ตัวหนังสืออ่านชัดเมื่อขยาย
            การอัปโหลดจะแทนที่ภาพเดิม
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-cream-100 file:px-4 file:py-2 file:font-semibold file:text-stone-700 hover:file:bg-cream-200"
          />
          {preview && (
            <div>
              <p className="text-xs text-stone-500 mb-1">ตัวอย่างก่อนอัปโหลด</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="ตัวอย่างโปสเตอร์ใหม่" className="max-h-80 rounded-lg border border-stone-200" />
            </div>
          )}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {notice && <p className="text-emerald-700 text-sm">{notice}</p>}
          <button type="submit" disabled={busy || !file} className="bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg px-5 py-2.5 font-semibold disabled:opacity-50">
            {busy ? "กำลังอัปโหลด..." : "อัปโหลดโปสเตอร์"}
          </button>
        </form>
      </div>
    </div>
  );
}
