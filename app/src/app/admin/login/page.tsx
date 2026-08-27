"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SiteNav from "@/app/components/site-nav";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      {open ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a3 3 0 0 0 4.24 4.24" />
          <path d="M6.6 6.7C4.3 8.2 2 12 2 12s3.5 7 10 7c1.6 0 3-.3 4.2-.9M9.9 4.2C10.6 4.1 11.3 4 12 4c6.5 0 10 8 10 8s-.7 1.6-2.1 3.3" />
        </>
      )}
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }
      router.push(searchParams.get("next") || "/admin");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full border border-stone-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow";

  return (
    <div className="min-h-screen flex flex-col bg-cream-100">
      <SiteNav />
      <div className="flex-1 flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-lg shadow-stone-900/5 border border-cream-200 px-8 pt-10 pb-8">
          <div className="flex flex-col items-center text-center mb-7">
            <img src="/logo.jpg" alt="ตราสัญลักษณ์" className="w-14 h-14 rounded-full object-cover shadow-sm" />
            <h1 className="mt-4 text-xl font-display font-semibold text-stone-800">เข้าสู่ระบบเจ้าหน้าที่</h1>
            <p className="text-sm text-stone-500 mt-1">ระบบจองโต๊ะงานคืนสู่เหย้า — สำหรับเจ้าหน้าที่เท่านั้น</p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-700">ชื่อผู้ใช้</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
                autoComplete="username"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-700">รหัสผ่าน</span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-10`}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-stone-400 hover:text-stone-600"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </label>

            <label className="flex items-center gap-2 text-sm text-stone-600 -mt-1">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="accent-maroon-700"
              />
              จดจำการเข้าสู่ระบบไว้ในเครื่องนี้
            </label>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              disabled={loading}
              className="bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg py-2.5 font-semibold disabled:opacity-50 mt-1"
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          <div className="flex items-center justify-center gap-1.5 text-xs text-stone-400 mt-6">
            <ShieldIcon />
            เข้าถึงได้เฉพาะเจ้าหน้าที่ที่ได้รับอนุญาตเท่านั้น
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary above it for the build's
// static-export pass (Next.js prerender check) — without this, `next build`
// fails with "useSearchParams() should be wrapped in a suspense boundary".
export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}
