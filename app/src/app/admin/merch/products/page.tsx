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
  stock: Record<string, number>;
}

const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

export default function AdminMerchProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [requiresSize, setRequiresSize] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  // Draft stock edits keyed by `${productId}:${size}` (size "" for
  // non-sized products), so typing in one box doesn't touch the others.
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [savingStock, setSavingStock] = useState<string | null>(null);

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

  function draftKey(productId: string, size: string) {
    return `${productId}:${size}`;
  }

  function stockValue(p: Product, size: string) {
    const key = draftKey(p.id, size);
    if (key in stockDrafts) return stockDrafts[key];
    return String(p.stock[size] ?? 0);
  }

  function updateDraft(productId: string, size: string, value: string) {
    setStockDrafts((prev) => ({ ...prev, [draftKey(productId, size)]: value }));
  }

  async function saveStock(p: Product) {
    const sizes = p.requiresSize ? SIZES : [""];
    const stock: Record<string, number> = {};
    for (const size of sizes) {
      const raw = stockValue(p, size);
      const qty = Math.max(0, Math.floor(Number(raw) || 0));
      stock[size] = qty;
    }
    setSavingStock(p.id);
    try {
      const res = await fetch(`/api/admin/merch/products/${p.id}/stock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "บันทึกสต๊อกไม่สำเร็จ");
        return;
      }
      // Clear drafts for this product so the freshly-saved values (from
      // the reload) become the new baseline.
      setStockDrafts((prev) => {
        const next = { ...prev };
        for (const size of sizes) delete next[draftKey(p.id, size)];
        return next;
      });
      load();
    } finally {
      setSavingStock(null);
    }
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
        <p className="text-xs text-gray-400">
          สินค้าที่สร้างใหม่จะมีสต๊อกเป็น 0 ทุกไซส์ — ตั้งจำนวนสต๊อกได้ในตารางด้านล่างหลังสร้างเสร็จ
        </p>
      </form>

      <div className="flex flex-col gap-3">
        {products.map((p) => {
          const sizes = p.requiresSize ? SIZES : [""];
          const totalStock = sizes.reduce((sum, s) => sum + (p.stock[s] ?? 0), 0);
          return (
            <div key={p.id} className="bg-white rounded-xl shadow p-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-16 h-16 object-cover rounded" />
                  ) : (
                    <div className="w-16 h-16 bg-slate-100 rounded" />
                  )}
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    {p.description && <div className="text-xs text-gray-400">{p.description}</div>}
                    <div className="text-sm text-primary-700 font-medium">{Number(p.price).toLocaleString()} บาท</div>
                    <input
                      type="file"
                      accept="image/*"
                      className="text-xs mt-1"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadImage(p.id, file);
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${totalStock > 0 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                    รวมสต๊อก {totalStock}
                  </span>
                  <button
                    onClick={() => toggleActive(p)}
                    className={`text-xs px-2 py-1 rounded ${p.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {p.active ? "เปิดขาย" : "ปิดขาย"}
                  </button>
                  <button onClick={() => deleteProduct(p.id)} className="text-red-500 hover:underline text-xs">
                    ลบ
                  </button>
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="text-xs font-medium text-gray-500 mb-2">
                  สต๊อกสินค้า{p.requiresSize ? " (แยกตามไซส์)" : ""}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  {sizes.map((size) => (
                    <label key={size || "single"} className="flex flex-col gap-1 text-xs">
                      <span className="text-gray-500">{size || "จำนวน"}</span>
                      <input
                        type="number"
                        min={0}
                        value={stockValue(p, size)}
                        onChange={(e) => updateDraft(p.id, size, e.target.value)}
                        className="border rounded px-2 py-1 w-20"
                      />
                    </label>
                  ))}
                  <button
                    onClick={() => saveStock(p)}
                    disabled={savingStock === p.id}
                    className="bg-slate-800 hover:bg-slate-900 text-white text-xs rounded px-3 py-1.5 disabled:opacity-50"
                  >
                    {savingStock === p.id ? "กำลังบันทึก..." : "บันทึกสต๊อก"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
