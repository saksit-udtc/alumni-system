"use client";

import { useEffect, useState } from "react";

type AdminRole = "SUPER_ADMIN" | "CHECKIN_STAFF" | "MERCH_STAFF";

type AdminUserRow = {
  id: string;
  username: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
};

const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "ผู้ดูแลระบบสูงสุด",
  CHECKIN_STAFF: "เจ้าหน้าที่เช็คอิน",
  MERCH_STAFF: "เจ้าหน้าที่ของที่ระลึก",
};

const inputClass =
  "border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ username: "", password: "", role: "CHECKIN_STAFF" as AdminRole });
  const [resetTarget, setResetTarget] = useState<AdminUserRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  function load() {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []));
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((d) => setMe(d?.username || null));
  }
  useEffect(load, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "เกิดข้อผิดพลาด");
      return;
    }
    setForm({ username: "", password: "", role: "CHECKIN_STAFF" });
    load();
  }

  async function changeRole(u: AdminUserRow, role: AdminRole) {
    setError(null);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "เกิดข้อผิดพลาด");
      return;
    }
    load();
  }

  async function toggleActive(u: AdminUserRow) {
    if (u.isActive && !confirm(`ระงับการใช้งานบัญชี "${u.username}"?`)) return;
    setError(null);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "เกิดข้อผิดพลาด");
      return;
    }
    load();
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setError(null);
    const res = await fetch(`/api/admin/users/${resetTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "เกิดข้อผิดพลาด");
      return;
    }
    setResetTarget(null);
    setResetPassword("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-stone-800">จัดการผู้ใช้งาน</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          บัญชีเจ้าหน้าที่ที่เข้าใช้งานระบบแอดมิน — เฉพาะผู้ดูแลระบบสูงสุดเท่านั้นที่เห็นเมนูนี้
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">{error}</div>
      )}

      <form onSubmit={submit} className="bg-white rounded-xl border border-cream-200 shadow-md p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <h2 className="sm:col-span-3 text-sm font-semibold text-stone-700 -mb-1">+ สร้างบัญชีใหม่</h2>
        <input
          placeholder="ชื่อผู้ใช้"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          className={inputClass}
          required
        />
        <input
          placeholder="รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className={inputClass}
          required
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}
          className={inputClass}
        >
          {(Object.keys(ROLE_LABELS) as AdminRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <div className="sm:col-span-3">
          <button className="bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg px-4 py-2 font-medium">
            + สร้างบัญชี
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-cream-200 shadow-md">
        <table className="w-full bg-white text-sm">
          <thead>
            <tr className="text-left bg-cream-100 text-stone-500 text-xs uppercase tracking-wide">
              <th className="p-3 font-semibold">ชื่อผู้ใช้</th>
              <th className="p-3 font-semibold">บทบาท</th>
              <th className="p-3 font-semibold">สถานะ</th>
              <th className="p-3 font-semibold">สร้างเมื่อ</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.username === me;
              return (
                <tr key={u.id} className="border-t border-cream-100 hover:bg-cream-50/60 transition-colors">
                  <td className="p-3 font-medium text-stone-800">
                    {u.username}
                    {isSelf && <span className="ml-2 text-xs text-stone-400">(คุณ)</span>}
                  </td>
                  <td className="p-3">
                    <select
                      value={u.role}
                      disabled={isSelf}
                      onChange={(e) => changeRole(u, e.target.value as AdminRole)}
                      className={`${inputClass} py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {(Object.keys(ROLE_LABELS) as AdminRole[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.isActive ? "bg-green-100 text-green-700" : "bg-stone-200 text-stone-500"
                      }`}
                    >
                      {u.isActive ? "ใช้งานอยู่" : "ถูกระงับ"}
                    </span>
                  </td>
                  <td className="p-3 text-stone-600">{formatDate(u.createdAt)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => {
                          setResetTarget(u);
                          setResetPassword("");
                        }}
                        className="text-primary-700 hover:text-primary-800 hover:underline"
                      >
                        รีเซ็ตรหัสผ่าน
                      </button>
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={isSelf}
                        className={`hover:underline disabled:opacity-50 disabled:cursor-not-allowed ${
                          u.isActive ? "text-red-600 hover:text-red-700" : "text-green-700 hover:text-green-800"
                        }`}
                      >
                        {u.isActive ? "ระงับการใช้งาน" : "เปิดใช้งาน"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={submitReset} className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm space-y-3">
            <h2 className="font-semibold text-stone-800">รีเซ็ตรหัสผ่าน: {resetTarget.username}</h2>
            <input
              placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className={`${inputClass} w-full`}
              required
              minLength={8}
              autoFocus
            />
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="bg-stone-100 hover:bg-stone-200 transition-colors text-stone-700 rounded-lg px-4 py-2"
              >
                ยกเลิก
              </button>
              <button className="bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg px-4 py-2 font-medium">
                บันทึก
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
