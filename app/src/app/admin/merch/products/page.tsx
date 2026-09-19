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
  // Extra gallery photos (the cover image above is separate) + optional
  // size-chart image — both shown on the shop's product detail view.
  images: { id: string; imageUrl: string }[];
  sizeGuideUrl: string | null;
  stock: Record<string, number>;
}

// Barcode/stock-row-id info, keyed by `${productId}:${size}` (size "" for
// non-sized products) — fetched separately from /api/admin/pos/products,
// which is the one endpoint that exposes MerchProductStock row ids and
// barcodes (the plain products list above only returns a size->qty map).
interface BarcodeInfo {
  stockId: string;
  barcode: string | null;
}

const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

export default function AdminMerchProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [barcodes, setBarcodes] = useState<Record<string, BarcodeInfo>>({});
  const [generatingBarcode, setGeneratingBarcode] = useState<string | null>(null);
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
  // Draft description edits keyed by product id (only present while edited).
  const [descDrafts, setDescDrafts] = useState<Record<string, string>>({});
  const [mediaBusy, setMediaBusy] = useState<string | null>(null);

  // การตั้งค่าค่าจัดส่ง/พร้อมเพย์ ย้ายไปเมนู "ตั้งค่าระบบ" (แก้ได้เฉพาะ SUPER_ADMIN)

  function load() {
    fetch("/api/admin/merch/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []));
    loadBarcodes();
  }
  useEffect(load, []);

  function loadBarcodes() {
    fetch("/api/admin/pos/products")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, BarcodeInfo> = {};
        for (const p of d.products || []) {
          for (const s of p.stocks || []) {
            map[draftKey(p.id, s.size || "")] = { stockId: s.id, barcode: s.barcode };
          }
        }
        setBarcodes(map);
      });
  }

  async function generateBarcode(stockId: string, regenerate: boolean) {
    setGeneratingBarcode(stockId);
    try {
      const res = await fetch("/api/admin/pos/products/generate-barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockId, regenerate }),
      });
      if (res.ok) loadBarcodes();
    } finally {
      setGeneratingBarcode(null);
    }
  }

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

  // Runs one of the media mutations below with a per-product busy flag and
  // surfaces server-side validation errors (wrong type / too large / etc).
  async function withMedia(productId: string, fn: () => Promise<Response>) {
    setMediaBusy(productId);
    try {
      const res = await fn();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "ดำเนินการไม่สำเร็จ");
      }
    } finally {
      setMediaBusy(null);
      load();
    }
  }

  async function uploadGalleryImages(id: string, files: FileList) {
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      await withMedia(id, () => fetch(`/api/admin/merch/products/${id}/gallery`, { method: "POST", body: formData }));
    }
  }

  async function deleteGalleryImage(id: string, imageId: string) {
    if (!confirm("ลบรูปนี้?")) return;
    await withMedia(id, () => fetch(`/api/admin/merch/products/${id}/gallery/${imageId}`, { method: "DELETE" }));
  }

  async function uploadSizeGuide(id: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    await withMedia(id, () => fetch(`/api/admin/merch/products/${id}/size-guide`, { method: "POST", body: formData }));
  }

  async function deleteSizeGuide(id: string) {
    if (!confirm("ลบรูปตารางขนาด?")) return;
    await withMedia(id, () => fetch(`/api/admin/merch/products/${id}/size-guide`, { method: "DELETE" }));
  }

  async function saveDescription(p: Product) {
    const value = descDrafts[p.id];
    if (value === undefined) return;
    await withMedia(p.id, () =>
      fetch(`/api/admin/merch/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: value }),
      })
    );
    setDescDrafts((prev) => {
      const next = { ...prev };
      delete next[p.id];
      return next;
    });
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
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">สินค้าที่ระลึก</h1>
          <p className="text-sm text-stone-500 mt-0.5">จัดการสินค้าและสต๊อกของที่ระลึกที่เปิดขาย ({products.length} รายการ)</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/pos" className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors">
            ขายหน้างาน (POS)
          </Link>
          <Link href="/admin/merch/products/barcode-labels" className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors">
            พิมพ์ป้ายบาร์โค้ด
          </Link>
          <Link href="/admin/merch/orders" className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors">
            ดูรายการสั่งซื้อ
          </Link>
        </div>
      </div>

      <form onSubmit={createProduct} className="bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-3">
        <h2 className="font-display font-semibold text-stone-800">+ เพิ่มสินค้าใหม่</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">ชื่อสินค้า *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">ราคา (บาท) *</span>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">รายละเอียด</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2" />
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={requiresSize} onChange={(e) => setRequiresSize(e.target.checked)} className="accent-maroon-700" />
          <span>สินค้านี้ต้องเลือกไซส์ (เช่น เสื้อ)</span>
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={creating}
          className="bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg py-2 px-4 font-semibold disabled:opacity-50"
        >
          {creating ? "กำลังเพิ่ม..." : "+ เพิ่มสินค้าใหม่"}
        </button>
        <p className="text-xs text-stone-400">
          สินค้าที่สร้างใหม่จะมีสต๊อกเป็น 0 ทุกไซส์ — ตั้งจำนวนสต๊อกได้ในตารางด้านล่างหลังสร้างเสร็จ
        </p>
      </form>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-cream-200 p-10 text-center text-stone-400 text-sm">
          ยังไม่มีสินค้าที่ระลึก — เพิ่มสินค้าแรกได้จากแบบฟอร์มด้านบน
        </div>
      ) : (
      <div className="flex flex-col gap-3">
        {products.map((p) => {
          const sizes = p.requiresSize ? SIZES : [""];
          const totalStock = sizes.reduce((sum, s) => sum + (p.stock[s] ?? 0), 0);
          return (
            <div key={p.id} className="bg-white rounded-xl border border-cream-200 shadow-md p-5 flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-16 h-16 object-cover rounded-lg" />
                  ) : (
                    <div className="w-16 h-16 bg-cream-100 rounded-lg" />
                  )}
                  <div>
                    <div className="font-display font-semibold text-stone-800">{p.name}</div>
                    {p.description && <div className="text-xs text-stone-400">{p.description}</div>}
                    <div className="text-sm text-maroon-700 font-medium">{Number(p.price).toLocaleString()} บาท</div>
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
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${totalStock > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    รวมสต๊อก {totalStock}
                  </span>
                  <button
                    onClick={() => toggleActive(p)}
                    className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${p.active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-stone-100 text-stone-500 hover:bg-stone-200"}`}
                  >
                    {p.active ? "เปิดขาย" : "ปิดขาย"}
                  </button>
                  <button onClick={() => deleteProduct(p.id)} className="text-red-600 hover:text-red-700 hover:underline text-xs">
                    ลบ
                  </button>
                </div>
              </div>

              <div className="border-t border-cream-200 pt-3 space-y-3">
                <div className="text-xs font-medium text-stone-500">รายละเอียดและรูปที่แสดงในหน้ารายละเอียดสินค้า</div>

                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-stone-500">รายละเอียดสินค้า (ขึ้นบรรทัดใหม่ได้)</span>
                  <textarea
                    rows={3}
                    value={descDrafts[p.id] ?? p.description ?? ""}
                    onChange={(e) => setDescDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-2 py-1.5 text-sm"
                  />
                </label>
                {descDrafts[p.id] !== undefined && (
                  <button
                    onClick={() => saveDescription(p)}
                    disabled={mediaBusy === p.id}
                    className="bg-maroon-700 hover:bg-maroon-800 transition-colors text-white text-xs rounded-lg px-3 py-1.5 font-medium disabled:opacity-50"
                  >
                    บันทึกรายละเอียด
                  </button>
                )}

                <div>
                  <div className="text-xs text-stone-500 mb-1">รูปเพิ่มเติม (สูงสุด 10 รูป — รูปหลักคือรูปที่อัปโหลดด้านบน)</div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {p.images.map((img) => (
                      <div key={img.id} className="relative">
                        <img src={img.imageUrl} alt="" className="w-16 h-16 object-cover rounded-lg border border-cream-200" />
                        <button
                          type="button"
                          onClick={() => deleteGalleryImage(p.id, img.id)}
                          aria-label="ลบรูปนี้"
                          className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 text-xs leading-none flex items-center justify-center"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <label className="w-16 h-16 border border-dashed border-stone-300 hover:border-maroon-700 rounded-lg flex items-center justify-center text-stone-400 hover:text-maroon-700 text-2xl cursor-pointer transition-colors">
                      +
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.length) uploadGalleryImages(p.id, e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {mediaBusy === p.id && <span className="text-xs text-stone-400">กำลังอัปโหลด...</span>}
                  </div>
                </div>

                {p.requiresSize && (
                  <div>
                    <div className="text-xs text-stone-500 mb-1">
                      รูปตารางขนาดของสินค้านี้ (ถ้าไม่อัปโหลด หน้าร้านจะแสดงตารางไซซ์เสื้อมาตรฐานของระบบแทน)
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {p.sizeGuideUrl && (
                        <div className="relative">
                          <img src={p.sizeGuideUrl} alt="ตารางขนาด" className="h-16 w-auto rounded-lg border border-cream-200" />
                          <button
                            type="button"
                            onClick={() => deleteSizeGuide(p.id)}
                            aria-label="ลบรูปตารางขนาด"
                            className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 text-xs leading-none flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="text-xs"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadSizeGuide(p.id, file);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-cream-200 pt-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-xs font-medium text-stone-500">
                    สต๊อกสินค้า{p.requiresSize ? " (แยกตามไซส์)" : ""}
                  </div>
                  <button
                    onClick={() => saveStock(p)}
                    disabled={savingStock === p.id}
                    className="bg-maroon-700 hover:bg-maroon-800 transition-colors text-white text-xs rounded-lg px-3 py-1.5 font-medium disabled:opacity-50"
                  >
                    {savingStock === p.id ? "กำลังบันทึก..." : "บันทึกสต๊อก"}
                  </button>
                </div>
                <div className={p.requiresSize ? "grid grid-cols-4 sm:grid-cols-8 gap-3" : "flex"}>
                  {sizes.map((size) => {
                    const info = barcodes[draftKey(p.id, size)];
                    return (
                      <div key={size || "single"} className={p.requiresSize ? "" : "w-28"}>
                        <label className="flex flex-col gap-1 text-xs">
                          <span className="text-stone-500">{size || "จำนวน"}</span>
                          <input
                            type="number"
                            min={0}
                            value={stockValue(p, size)}
                            onChange={(e) => updateDraft(p.id, size, e.target.value)}
                            className="w-full border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-2 py-1.5 text-sm"
                          />
                        </label>
                        {info && (
                          <div className="mt-1">
                            {info.barcode ? (
                              <button
                                onClick={() => generateBarcode(info.stockId, true)}
                                disabled={generatingBarcode === info.stockId}
                                title="คลิกเพื่อสร้างบาร์โค้ดใหม่"
                                className="w-full text-[10px] font-mono text-stone-500 hover:text-maroon-700 truncate text-left disabled:opacity-50"
                              >
                                {generatingBarcode === info.stockId ? "..." : info.barcode}
                              </button>
                            ) : (
                              <button
                                onClick={() => generateBarcode(info.stockId, false)}
                                disabled={generatingBarcode === info.stockId}
                                className="w-full text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-600 rounded px-1 py-0.5 disabled:opacity-50"
                              >
                                {generatingBarcode === info.stockId ? "..." : "+ บาร์โค้ด"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
