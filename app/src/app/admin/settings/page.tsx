"use client";

import { useEffect, useState } from "react";

/**
 * ตั้งค่าระบบ — เฉพาะผู้ดูแลระบบสูงสุด (SUPER_ADMIN)
 * ตั้งค่า 2 อย่างที่กระทบทั้งระบบ:
 *  1) บัญชีพร้อมเพย์รับเงิน (ใช้สร้าง QR ทั้งจองโต๊ะ/ของที่ระลึก และ POS หน้างาน)
 *  2) ค่าจัดส่งของที่ระลึก
 * การจำกัดสิทธิ์จริงอยู่ที่ /api/admin/settings (requireAdmin ["SUPER_ADMIN"])
 * และ middleware — หน้านี้เป็นแค่ UI
 */
const THEME_OPTIONS = [
  {
    id: "navy-gold",
    title: "กรมท่า-ทอง",
    desc: "โทนเดียวกับหน้าแรกเดิม พื้นกรมท่าเข้ม ตัดด้วยสีทอง",
    swatch: ["#0A1E33", "#16385C", "#C6A15B", "#F3EFE6"],
  },
  {
    id: "white-gold",
    title: "ขาว-ทอง",
    desc: "พื้นขาวนวล สว่าง สบายตา ตัดด้วยสีทอง",
    swatch: ["#FFFFFF", "#FBF4E0", "#C6A15B", "#8F6C22"],
  },
  {
    id: "blue-orange",
    title: "น้ำเงิน-ส้ม",
    desc: "แบบเว็บงานวิ่ง FunRun พื้นขาว-ฟ้าอ่อน ปุ่มสีน้ำเงิน ตัดด้วยสีส้ม",
    swatch: ["#FFFFFF", "#EEF4FB", "#1D63C4", "#F15A22"],
  },
] as const;

function ThemeSection() {
  const [theme, setTheme] = useState<string>("navy-gold");
  const [current, setCurrent] = useState<string>("navy-gold");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/theme")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setTheme(d.theme);
        setCurrent(d.theme);
      })
      .catch(() => {});
  }, []);

  async function saveTheme() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      if (res.status === 401) {
        // เซสชันแอดมินหมดอายุ (โทเค็นอายุ 12 ชั่วโมง) → พาไปล็อกอินใหม่แล้วกลับมาหน้านี้
        setMsg("เซสชันหมดอายุ กำลังพาไปหน้าเข้าสู่ระบบ...");
        window.location.href = "/admin/login?next=/admin/settings";
        return;
      }
      if (!res.ok) {
        setMsg((await res.json().catch(() => ({}))).error || "บันทึกธีมไม่สำเร็จ");
        return;
      }
      // รีโหลดเพื่อให้ทั้งหน้าเปลี่ยนเป็นธีมใหม่ทันที
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-4">
      <div>
        <h2 className="font-display font-semibold text-stone-800">ธีมสีของเว็บไซต์</h2>
        <p className="text-sm text-stone-500 mt-1">เลือกโทนสีของทั้งเว็บ (หน้าแรก หน้าจอง หน้าสั่งของที่ระลึก และหน้าแอดมิน) มีผลกับทุกคนทันทีหลังบันทึก</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="ธีมสีของเว็บไซต์">
        {THEME_OPTIONS.map((o) => {
          const selected = theme === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(o.id)}
              className={`text-left rounded-xl border-2 p-4 transition-colors ${selected ? "border-maroon-700 bg-cream-100" : "border-cream-200 hover:border-primary-400"}`}
            >
              <div className="flex overflow-hidden rounded-lg border border-stone-200 h-12 mb-3">
                {o.swatch.map((c) => (
                  <span key={c} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-stone-800">{o.title}</span>
                {o.id === current && <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">ใช้งานอยู่</span>}
              </div>
              <p className="text-sm text-stone-500 mt-0.5">{o.desc}</p>
            </button>
          );
        })}
      </div>
      {msg && <p className="text-red-600 text-sm">{msg}</p>}
      <button
        type="button"
        onClick={saveTheme}
        disabled={saving || theme === current}
        className="bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg px-5 py-2.5 font-semibold disabled:opacity-50"
      >
        {saving ? "กำลังบันทึก..." : "ใช้ธีมนี้"}
      </button>
    </div>
  );
}

export default function SystemSettingsPage() {
  const [promptPayId, setPromptPayId] = useState("");
  const [shippingFee, setShippingFee] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setPromptPayId(d.promptPayId ?? "");
        setShippingFee(String(d.shippingFee ?? 0));
      })
      .catch(() => setError("โหลดค่าตั้งค่าไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const fee = Number(shippingFee);
    if (!Number.isFinite(fee) || fee < 0) {
      setError("กรุณากรอกค่าจัดส่งเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptPayId: promptPayId.trim(), shippingFee: fee }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setPromptPayId(data.promptPayId ?? "");
      setShippingFee(String(data.shippingFee ?? 0));
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-stone-400 py-10 text-center">กำลังโหลด...</div>;
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-semibold text-stone-800">ตั้งค่าระบบ</h1>
        <p className="text-sm text-stone-500 mt-1">
          ค่าเหล่านี้กระทบทั้งระบบ และแก้ไขได้เฉพาะผู้ดูแลระบบสูงสุด (SUPER_ADMIN) เท่านั้น
        </p>
      </div>

      <ThemeSection />

      <form onSubmit={save} className="bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-5">
        {/* บัญชีพร้อมเพย์รับเงิน (ใช้ทั้งจองออนไลน์/ของที่ระลึก และ POS) */}
        <div className="space-y-2">
          <h2 className="font-display font-semibold text-stone-800">บัญชีรับเงิน (พร้อมเพย์) สำหรับสร้าง QR</h2>
          <p className="text-sm text-stone-500">
            เบอร์โทร (หรือเลขบัตรประชาชน/นิติบุคคล) ที่ผูกพร้อมเพย์ไว้ — ใช้สร้าง QR ระบุยอดเงินให้ลูกค้าสแกนจ่าย
            ทั้งหน้า<b>จองโต๊ะ</b>, <b>สั่งของที่ระลึก</b> และ<b>ขายหน้างาน (POS)</b> เว้นว่างได้ = ระบบจะไม่แสดง QR จนกว่าจะตั้งใหม่
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">เบอร์พร้อมเพย์ / เลขบัตร ปชช. / เลขนิติบุคคล</span>
            <input
              value={promptPayId}
              onChange={(e) => setPromptPayId(e.target.value)}
              placeholder="เช่น 0812345678"
              className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2 w-full sm:w-72"
            />
          </label>
        </div>

        <hr className="border-cream-200" />

        {/* ค่าจัดส่งของที่ระลึก */}
        <div className="space-y-2">
          <h2 className="font-display font-semibold text-stone-800">ค่าจัดส่งของที่ระลึก</h2>
          <p className="text-sm text-stone-500">
            รวมเข้ากับยอดชำระของทุกคำสั่งซื้อ<b>ใหม่</b>โดยอัตโนมัติ (คำสั่งซื้อเก่าจะไม่เปลี่ยนแปลงตามค่าที่แก้ไขนี้)
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">ค่าจัดส่ง (บาท)</span>
            <input
              type="number"
              min={0}
              value={shippingFee}
              onChange={(e) => setShippingFee(e.target.value)}
              className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2 w-40"
            />
          </label>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {saved && <p className="text-emerald-600 text-sm">บันทึกการตั้งค่าเรียบร้อยแล้ว</p>}

        <div className="pt-1">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg px-5 py-2.5 font-semibold disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
          </button>
        </div>
      </form>
    </div>
  );
}
