"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      router.push(searchParams.get("next") || "/admin/events");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-sm mx-auto p-4 mt-16">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-primary-700 hover:underline mb-4">
        ← กลับหน้าแรก
      </Link>
      <h1 className="text-xl font-bold mb-4 text-center">เข้าสู่ระบบเจ้าหน้าที่</h1>
      <form onSubmit={submit} className="flex flex-col gap-3 bg-white p-4 rounded-xl shadow">
        <label className="flex flex-col gap-1">
          <span className="text-sm">ชื่อผู้ใช้</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="border rounded px-3 py-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">รหัสผ่าน</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border rounded px-3 py-2"
            required
          />
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button disabled={loading} className="bg-primary-600 text-white rounded py-2 font-semibold disabled:opacity-50">
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
    </main>
  );
}
