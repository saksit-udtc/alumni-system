"use client";

import { useEffect, useState } from "react";

export default function AdminAlumniPage() {
  const [alumni, setAlumni] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ fullName: "", graduationYear: "", department: "", phone: "", email: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  function load() {
    fetch(`/api/admin/alumni${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((r) => r.json())
      .then((d) => setAlumni(d.alumni || []));
  }
  useEffect(load, [q]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      await fetch(`/api/admin/alumni/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/admin/alumni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setForm({ fullName: "", graduationYear: "", department: "", phone: "", email: "" });
    setEditingId(null);
    load();
  }

  function edit(a: any) {
    setEditingId(a.id);
    setForm({
      fullName: a.fullName,
      graduationYear: a.graduationYear || "",
      department: a.department || "",
      phone: a.phone || "",
      email: a.email || "",
    });
  }

  async function remove(id: string) {
    if (!confirm("ยืนยันลบข้อมูลศิษย์เก่านี้?")) return;
    await fetch(`/api/admin/alumni/${id}`, { method: "DELETE" });
    load();
  }

  const inputClass =
    "border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">ทำเนียบศิษย์เก่า</h1>
          <p className="text-sm text-stone-500 mt-0.5">ฐานข้อมูลศิษย์เก่าที่ลงทะเบียนไว้ในระบบ</p>
        </div>
        <div className="bg-white rounded-xl border border-cream-200 shadow-md px-4 py-2.5 text-center">
          <div className="text-xl font-display font-semibold text-maroon-700 leading-tight">{alumni.length}</div>
          <div className="text-xs text-stone-500">รายชื่อ{q ? "ที่พบ" : "ทั้งหมด"}</div>
        </div>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl border border-cream-200 shadow-md p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <h2 className="sm:col-span-2 text-sm font-semibold text-stone-700 -mb-1">
          {editingId ? "แก้ไขข้อมูลศิษย์เก่า" : "+ เพิ่มศิษย์เก่าใหม่"}
        </h2>
        <input placeholder="ชื่อ-นามสกุล *" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputClass} required />
        <input placeholder="ปีที่จบ" value={form.graduationYear} onChange={(e) => setForm({ ...form, graduationYear: e.target.value })} className={inputClass} />
        <input placeholder="แผนกวิชา" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={inputClass} />
        <input placeholder="เบอร์โทรศัพท์" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
        <input placeholder="อีเมล" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${inputClass} sm:col-span-2`} />
        <div className="sm:col-span-2 flex gap-2 pt-1">
          <button className="bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg px-4 py-2 font-medium">
            {editingId ? "บันทึกการแก้ไข" : "+ เพิ่มศิษย์เก่า"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({ fullName: "", graduationYear: "", department: "", phone: "", email: "" });
              }}
              className="bg-stone-100 hover:bg-stone-200 transition-colors text-stone-700 rounded-lg px-4 py-2"
            >
              ยกเลิก
            </button>
          )}
        </div>
      </form>

      <div>
        <input placeholder="ค้นหาชื่อ, เบอร์โทร หรือแผนกวิชา..." value={q} onChange={(e) => setQ(e.target.value)} className={`${inputClass} mb-3 w-full sm:w-80`} />

        {alumni.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-cream-200 p-10 text-center text-stone-400 text-sm">
            {q ? (
              <p>ไม่พบศิษย์เก่าที่ตรงกับ &quot;{q}&quot;</p>
            ) : (
              <p>ยังไม่มีข้อมูลศิษย์เก่าในระบบ — เพิ่มรายชื่อแรกได้จากแบบฟอร์มด้านบน</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-cream-200 shadow-md">
            <table className="w-full bg-white text-sm">
              <thead>
                <tr className="text-left bg-cream-100 text-stone-500 text-xs uppercase tracking-wide">
                  <th className="p-3 font-semibold">ชื่อ-นามสกุล</th>
                  <th className="p-3 font-semibold">ปีที่จบ</th>
                  <th className="p-3 font-semibold">แผนกวิชา</th>
                  <th className="p-3 font-semibold">เบอร์โทร</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {alumni.map((a) => (
                  <tr key={a.id} className="border-t border-cream-100 hover:bg-cream-50/60 transition-colors">
                    <td className="p-3 font-medium text-stone-800">{a.fullName}</td>
                    <td className="p-3 text-stone-600">{a.graduationYear}</td>
                    <td className="p-3 text-stone-600">{a.department}</td>
                    <td className="p-3 text-stone-600">{a.phone}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-3">
                        <button onClick={() => edit(a)} className="text-primary-700 hover:text-primary-800 hover:underline">
                          แก้ไข
                        </button>
                        <button onClick={() => remove(a.id)} className="text-red-600 hover:text-red-700 hover:underline">
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
