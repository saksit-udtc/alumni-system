"use client";

import { useState } from "react";
import Link from "next/link";
import SiteNav from "@/app/components/site-nav";

// Standalone version of the alumni self-registration that already exists
// inline as the "ฉันเป็นศิษย์เก่า" checkbox in reserve-form.tsx — same
// fields, same POST target (/api/alumni) — for people who want to join the
// alumni directory without going through a table booking first. Linked
// from the "ลงทะเบียนศิษย์เก่า" card on the homepage.
export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [department, setDepartment] = useState("");
  const [currentOccupation, setCurrentOccupation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lineId, setLineId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) {
      setError("กรุณากรอกชื่อ-นามสกุล");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/alumni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          graduationYear: graduationYear || undefined,
          department: department || undefined,
          currentOccupation: currentOccupation || undefined,
          phone: phone || undefined,
          email: email || undefined,
          lineId: lineId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setDone(true);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <SiteNav />

      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <span className="text-xs font-medium tracking-wide uppercase text-maroon-700">ทำเนียบศิษย์เก่า</span>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-stone-800 mt-1">ลงทะเบียนศิษย์เก่า</h1>
          <p className="text-stone-500 text-sm mt-2">
            เพิ่มชื่อของคุณเข้าทำเนียบศิษย์เก่า เพื่อให้วิทยาลัยติดต่อและแจ้งข่าวสารรุ่นได้
          </p>
        </div>

        {done ? (
          <div className="bg-white rounded-2xl border border-cream-200 shadow-md p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h2 className="font-display font-semibold text-stone-800 text-lg">ลงทะเบียนสำเร็จ</h2>
            <p className="text-stone-500 text-sm mt-1.5">ขอบคุณที่ร่วมเป็นส่วนหนึ่งของทำเนียบศิษย์เก่าครับ/ค่ะ</p>
            <Link
              href="/"
              className="inline-block mt-6 text-sm font-medium bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg px-5 py-2.5"
            >
              กลับหน้าแรก
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white rounded-2xl border border-cream-200 shadow-md p-6 sm:p-7 space-y-4">
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">ชื่อ-นามสกุล *</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">ปีที่จบ</label>
                <input
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  placeholder="เช่น 2560"
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">สาขาวิชา</label>
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">อาชีพปัจจุบัน</label>
              <input
                value={currentOccupation}
                onChange={(e) => setCurrentOccupation(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">เบอร์โทร</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Line ID</label>
                <input
                  value={lineId}
                  onChange={(e) => setLineId(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">อีเมล</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "กำลังบันทึก..." : "ลงทะเบียน"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
