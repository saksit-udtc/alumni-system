"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string;
  requiresSize: boolean;
  active: boolean;
  imageUrl: string | null;
}

export default function AdminMerchProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [requiresSize, setRequiresSize] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function load() {
    fetch("/api/admin/merch/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []));
  }
  useEffect(load, []);

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !price) {
      setError("กรุณากรอกชื่อสินค้าและราคา");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/merch/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, price: Number(price), requiresSize }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }
      setName("");
      setDescription("");
      setPrice("");
      setRequiresSize(false);
      load();
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(p: Product) {
    await fetch(`/api/admin/merch/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    load();
  }

  async function deleteProduct(id: string) {
    if (!confirm("ยืนยันลบสินค้านี้?")) return;
    const res = await fetch(`/api/admin/merch/products/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "ลบไม่สำเร็จ");
    }
    load();
  }

  async function uploadImage(id: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    await fetch(`/api/admin/merch/products/${id}/image`, { method: "POST", body: formData });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">สินค้าที่ระลึก</h1>
        <Link href="/admin/merch/orders" className="text-primary-600 hover:underline text-sm">
          ดูรายการสั่งซื้อ
        </Link>
      </div>

      <form onSubmit={createProduct} className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">+ เพิ่มสินค้าใหม่</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">ชื่อสินค้า *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">ราคา (บาท) *</span>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">รายละเอียด</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="border rounded px-3 py-2" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={requiresSize} onChange={(e) => setRequiresSize(e.target.checked)} />
          <span>สินค้านี้ต้องเลือกไซส์ (เช่น เสื้อ)</span>
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={creating}
          className="bg-primary-600 hover:bg-primary-700 text-white rounded py-2 px-4 font-semibold disabled:opacity-50"
        >
          {creating ? "กำลังเพิ่ม..." : "+ เพิ่มสินค้าใหม่"}
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-xl shadow text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">รูป</th>
              <th className="p-2">ชื่อสินค้า</th>
              <th className="p-2">ราคา</th>
              <th className="p-2">ไซส์</th>
              <th className="p-2">สถานะ</th>
              <th className="p-2">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b align-top">
                <td className="p-2">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <div className="w-12 h-12 bg-slate-100 rounded" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="text-xs mt-1"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadImage(p.id, file);
                    }}
                  />
                </td>
                <td className="p-2">
                  <div>{p.name}</div>
                  {p.description && <div className="text-xs text-gray-400">{p.description}</div>}
                </td>
                <td className="p-2">{Number(p.price).toLocaleString()} บาท</td>
                <td className="p-2">{p.requiresSize ? "ต้องเลือกไซส์" : "—"}</td>
                <td className="p-2">
                  <button
                    onClick={() => toggleActive(p)}
                    className={`text-xs px-2 py-1 rounded ${p.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {p.active ? "เปิดขาย" : "ปิดขาย"}
                  </button>
                </td>
                <td className="p-2">
                  <button onClick={() => deleteProduct(p.id)} className="text-red-500 hover:underline text-xs">
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
