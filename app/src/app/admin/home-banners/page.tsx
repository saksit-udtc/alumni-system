"use client";

import { useEffect, useRef, useState } from "react";

interface Banner {
  id: string;
  title: string | null;
  linkUrl: string | null;
  sortOrder: number;
  active: boolean;
  imageUrl: string;
}

export default function AdminHomeBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autoplay interval setting — separate load/save from the banner list above.
  const [intervalSeconds, setIntervalSeconds] = useState<number | null>(null);
  const [intervalDraft, setIntervalDraft] = useState("");
  const [savingInterval, setSavingInterval] = useState(false);
  const [intervalError, setIntervalError] = useState("");

  function load() {
    fetch("/api/admin/home-banners")
      .then((r) => r.json())
      .then((d) => setBanners(d.banners || []));
  }
  useEffect(load, []);

  function loadInterval() {
    fetch("/api/admin/home-banners/settings")
      .then((r) => r.json())
      .then((d) => {
        setIntervalSeconds(Number(d.intervalSeconds) || 5);
        setIntervalDraft(String(d.intervalSeconds ?? 5));
      });
  }
  useEffect(loadInterval, []);

  async function saveInterval(e: React.FormEvent) {
    e.preventDefault();
    setIntervalError("");
    const seconds = Number(intervalDraft);
    if (!Number.isFinite(seconds) || seconds < 1) {
      setIntervalError("กรุณากรอกเวลาเป็นตัวเลขวินาทีที่มากกว่าหรือเท่ากับ 1");
      return;
    }
    setSavingInterval(true);
    try {
      const res = await fetch("/api/admin/home-banners/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervalSeconds: seconds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIntervalError(data.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setIntervalSeconds(data.intervalSeconds);
    } finally {
      setSavingInterval(false);
    }
  }

  async function createBanner(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("กรุณาเลือกไฟล์รูปแบนเนอร์");
      return;
    }
    setCreating(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (title.trim()) formData.append("title", title.trim());
      if (linkUrl.trim()) formData.append("linkUrl", linkUrl.trim());
      const res = await fetch("/api/admin/home-banners", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }
      setTitle("");
      setLinkUrl("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      load();
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(b: Banner) {
    await fetch(`/api/admin/home-banners/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !b.active }),
    });
    load();
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= banners.length) return;
    const a = banners[index];
    const b = banners[target];
    await Promise.all([
      fetch(`/api/admin/home-banners/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: b.sortOrder }),
      }),
      fetch(`/api/admin/home-banners/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: a.sortOrder }),
      }),
    ]);
    load();
  }

  async function deleteBanner(id: string) {
    if (!confirm("ยืนยันลบแบนเนอร์นี้?")) return;
    const res = await fetch(`/api/admin/home-banners/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) alert(data.error || "ลบไม่สำเร็จ");
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-semibold text-stone-800">แบนเนอร์หน้าแรก</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          จัดการรูปสไลด์โฆษณาบนสุดของหน้าแรก เช่น กำหนดการ ศิลปินที่มาแสดง หรือของที่ระลึก ({banners.length} รายการ)
        </p>
      </div>

      <form onSubmit={saveInterval} className="bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-3">
        <h2 className="font-display font-semibold text-stone-800">ความเร็วสไลด์</h2>
        <p className="text-sm text-stone-500">ระยะเวลาที่แต่ละแบนเนอร์แสดงก่อนเลื่อนไปรูปถัดไปอัตโนมัติ ปรับได้อิสระตามต้องการ</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">เวลาต่อสไลด์ (วินาที)</span>
            <input
              type="number"
              min={1}
              step={0.5}
              value={intervalDraft}
              onChange={(e) => setIntervalDraft(e.target.value)}
              className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2 w-40"
            />
          </label>
          <button
            type="submit"
            disabled={savingInterval}
            className="bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
          >
            {savingInterval ? "กำลังบันทึก..." : "บันทึกความเร็วสไลด์"}
          </button>
          {intervalSeconds !== null && <span className="text-sm text-stone-500">ปัจจุบัน: {intervalSeconds} วินาที/สไลด์</span>}
        </div>
        {intervalError && <p className="text-red-600 text-sm">{intervalError}</p>}
      </form>

      <form onSubmit={createBanner} className="bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-3">
        <h2 className="font-display font-semibold text-stone-800">+ เพิ่มแบนเนอร์ใหม่</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">หัวข้อ (ไม่บังคับ)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2"
              placeholder="เช่น กำหนดการงาน"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">ลิงก์เมื่อคลิก (ไม่บังคับ)</span>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2"
              placeholder="เช่น /merch หรือ https://..."
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">รูปแบนเนอร์ * (แนะนำอัตราส่วนแนวนอนกว้าง เช่น 1600x600)</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm"
          />
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={creating}
          className="bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg py-2 px-4 font-semibold disabled:opacity-50"
        >
          {creating ? "กำลังเพิ่ม..." : "+ เพิ่มแบนเนอร์"}
        </button>
      </form>

      {banners.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-cream-200 p-10 text-center text-stone-400 text-sm">
          ยังไม่มีแบนเนอร์ — เพิ่มรูปแรกได้จากแบบฟอร์มด้านบน
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {banners.map((b, idx) => (
            <div key={b.id} className="bg-white rounded-xl border border-cream-200 shadow-md p-4 flex flex-wrap items-center gap-4">
              <img src={b.imageUrl} alt={b.title || "แบนเนอร์"} className="w-32 h-16 object-cover rounded-lg border border-cream-200 shrink-0" />
              <div className="flex-1 min-w-[160px]">
                <div className="font-display font-semibold text-stone-800">{b.title || <span className="text-stone-400 font-normal">(ไม่มีหัวข้อ)</span>}</div>
                {b.linkUrl && <div className="text-xs text-primary-700 truncate max-w-xs">{b.linkUrl}</div>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  aria-label="เลื่อนขึ้น"
                  className="w-8 h-8 rounded-lg border border-stone-300 text-stone-600 hover:bg-cream-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(idx, 1)}
                  disabled={idx === banners.length - 1}
                  aria-label="เลื่อนลง"
                  className="w-8 h-8 rounded-lg border border-stone-300 text-stone-600 hover:bg-cream-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  ↓
                </button>
                <button
                  onClick={() => toggleActive(b)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${b.active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-stone-100 text-stone-500 hover:bg-stone-200"}`}
                >
                  {b.active ? "แสดงอยู่" : "ซ่อนอยู่"}
                </button>
                <button onClick={() => deleteBanner(b.id)} className="text-red-600 hover:text-red-700 hover:underline text-xs px-1">
                  ลบ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
