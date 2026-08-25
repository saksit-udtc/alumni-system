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

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">ทำเนียบศิษย์เก่า</h1>

      <form onSubmit={submit} className="bg-white rounded-xl shadow p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input placeholder="ชื่อ-นามสกุล *" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="border rounded px-3 py-2" required />
        <input placeholder="ปีที่จบ" value={form.graduationYear} onChange={(e) => setForm({ ...form, graduationYear: e.target.value })} className="border rounded px-3 py-2" />
        <input placeholder="แผนกวิชา" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="border rounded px-3 py-2" />
        <input placeholder="เบอร์โทรศัพท์" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="border rounded px-3 py-2" />
        <input placeholder="อีเมล" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border rounded px-3 py-2 sm:col-span-2" />
        <div className="sm:col-span-2 flex gap-2">
          <button className="bg-primary-600 text-white rounded px-4 py-2">{editingId ? "บันทึกการแก้ไข" : "+ เพิ่มศิษย์เก่า"}</button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({ fullName: "", graduationYear: "", department: "", phone: "", email: "" });
              }}
              className="bg-gray-100 rounded px-4 py-2"
            >
              ยกเลิก
            </button>
          )}
        </div>
      </form>

      <input placeholder="ค้นหา..." value={q} onChange={(e) => setQ(e.target.value)} className="border rounded px-3 py-2 mb-2 w-full sm:w-64" />

      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-xl shadow text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">ชื่อ-นามสกุล</th>
              <th className="p-2">ปีที่จบ</th>
              <th className="p-2">แผนกวิชา</th>
              <th className="p-2">เบอร์โทร</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {alumni.map((a) => (
              <tr key={a.id} className="border-b">
                <td className="p-2">{a.fullName}</td>
                <td className="p-2">{a.graduationYear}</td>
                <td className="p-2">{a.department}</td>
                <td className="p-2">{a.phone}</td>
                <td className="p-2 flex flex-wrap gap-2">
                  <button onClick={() => edit(a)} className="text-primary-600 hover:underline">
                    แก้ไข
                  </button>
                  <button onClick={() => remove(a.id)} className="text-red-500 hover:underline">
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
