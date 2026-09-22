"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface EventOption {
  id: string;
  name: string;
  eventDate: string;
  status: string;
  seatsPerTable: number;
  // Actual distinct table capacities in this event — what a full_table
  // package's seatCount must match at booking time (see
  // lib/bookPackage.ts), which can differ from seatsPerTable.
  tableCapacities: number[];
}

interface ProductOption {
  id: string;
  name: string;
  requiresSize: boolean;
  stocks: { id: string; size: string | null; quantity: number }[];
}

interface PackageItem {
  id: string;
  productId: string;
  size: string | null;
  quantity: number;
  buyerChoosesSize: boolean;
  product: { id: string; name: string; requiresSize: boolean };
}

interface PackageRow {
  id: string;
  name: string;
  description: string | null;
  bookingType: "full_table" | "seats" | null;
  seatCount: number | null;
  price: string;
  active: boolean;
  event: { id: string; name: string; eventDate: string; status: string };
  items: PackageItem[];
  _count: { reservations: number };
}

// Draft shape for an item row while building/editing a package's item list.
interface ItemDraft {
  productId: string;
  size: string; // "" means no-size product, or buyerChoosesSize is true
  quantity: string;
  buyerChoosesSize: boolean;
}

const emptyItem: ItemDraft = { productId: "", size: "", quantity: "1", buyerChoosesSize: false };
// "none" is a client-only sentinel for "merch-only package, no table at
// all" — sent to the API as bookingType:"none", stored in the DB as null.
type BookingTypeChoice = "full_table" | "seats" | "none";

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [eventId, setEventId] = useState("");
  const [bookingType, setBookingType] = useState<BookingTypeChoice>("full_table");
  const [seatCount, setSeatCount] = useState("");
  const [price, setPrice] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([{ ...emptyItem }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/packages").then((r) => r.json()),
      fetch("/api/admin/packages/events-options").then((r) => r.json()),
      fetch("/api/admin/packages/products-options").then((r) => r.json()),
    ])
      .then(([pkgData, eventData, productData]) => {
        setPackages(pkgData.packages || []);
        setEvents(eventData.events || []);
        setProducts(productData.products || []);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setEventId("");
    setBookingType("full_table");
    setSeatCount("");
    setPrice("");
    setItems([{ ...emptyItem }]);
    setError("");
    setShowForm(false);
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(p: PackageRow) {
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description || "");
    setEventId(p.event.id);
    setBookingType(p.bookingType ?? "none");
    setSeatCount(p.seatCount ? String(p.seatCount) : "");
    setPrice(p.price);
    setItems(
      p.items.length
        ? p.items.map((it) => ({
            productId: it.productId,
            size: it.size || "",
            quantity: String(it.quantity),
            buyerChoosesSize: it.buyerChoosesSize,
          }))
        : [{ ...emptyItem }]
    );
    setError("");
    setShowForm(true);
  }

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function addItemRow() {
    setItems((prev) => [...prev, { ...emptyItem }]);
  }
  function removeItemRow(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function sizesFor(productId: string): string[] {
    const product = products.find((p) => p.id === productId);
    if (!product) return [];
    return product.stocks.map((s) => s.size || "");
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleanItems = items
      .filter((it) => it.productId)
      .map((it) => ({
        productId: it.productId,
        size: it.buyerChoosesSize ? null : it.size || null,
        quantity: Math.max(1, Math.floor(Number(it.quantity) || 0)),
        buyerChoosesSize: it.buyerChoosesSize,
      }));

    const merchOnly = bookingType === "none";

    if (!name.trim()) return setError("กรุณาระบุชื่อแพ็กเกจ");
    if (!editingId && !eventId) return setError("กรุณาเลือกงาน");
    if (!merchOnly && (!seatCount || Number(seatCount) <= 0)) return setError("กรุณาระบุจำนวนที่นั่ง");
    if (!price || Number(price) < 0) return setError("กรุณาระบุราคาแพ็กเกจ");
    if (cleanItems.length === 0) return setError("กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ");

    setSaving(true);
    try {
      const body = {
        name,
        description,
        eventId,
        bookingType,
        seatCount: merchOnly ? 0 : Number(seatCount),
        price: Number(price),
        items: cleanItems,
      };
      const res = await fetch(editingId ? `/api/admin/packages/${editingId}` : "/api/admin/packages", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }
      resetForm();
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: PackageRow) {
    await fetch(`/api/admin/packages/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: p.name,
        description: p.description,
        bookingType: p.bookingType ?? "none",
        seatCount: p.seatCount ?? 0,
        price: p.price,
        active: !p.active,
        items: p.items.map((it) => ({
          productId: it.productId,
          size: it.size,
          quantity: it.quantity,
          buyerChoosesSize: it.buyerChoosesSize,
        })),
      }),
    });
    load();
  }

  async function deletePackage(id: string) {
    if (!confirm("ยืนยันลบแพ็กเกจนี้?")) return;
    const res = await fetch(`/api/admin/packages/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) alert(data.error || "ลบไม่สำเร็จ");
    load();
  }

  const selectedEvent = events.find((e) => e.id === eventId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">แพ็กเกจขาย</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            ตั้งค่าแพ็กเกจสำเร็จรูป (จองโต๊ะ + แถมสินค้า หรือเฉพาะของที่ระลึก) เพื่อขายผ่าน POS หน้างาน ({packages.length} แพ็กเกจ)
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/pos/package" className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors">
            ขายแพ็กเกจหน้างาน (POS)
          </Link>
          {!showForm && (
            <button
              onClick={startCreate}
              className="bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg px-4 py-2 text-sm font-semibold"
            >
              + เพิ่มแพ็กเกจใหม่
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={submitForm} className="bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-3">
          <h2 className="font-display font-semibold text-stone-800">{editingId ? "แก้ไขแพ็กเกจ" : "+ เพิ่มแพ็กเกจใหม่"}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">ชื่อแพ็กเกจ *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น จองโต๊ะ + เสื้อที่ระลึก"
                className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">ราคาแพ็กเกจ (บาท) *</span>
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
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">งาน *</span>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                disabled={!!editingId}
                className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2 disabled:bg-stone-100"
              >
                <option value="">-- เลือกงาน --</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({new Date(ev.eventDate).toLocaleDateString("th-TH")})
                  </option>
                ))}
              </select>
              {editingId && <span className="text-xs text-stone-400">ไม่สามารถเปลี่ยนงานของแพ็กเกจที่มีอยู่แล้วได้</span>}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">รูปแบบการจอง *</span>
              <select
                value={bookingType}
                onChange={(e) => setBookingType(e.target.value as BookingTypeChoice)}
                className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2"
              >
                <option value="full_table">จองทั้งโต๊ะ + ของแถม</option>
                <option value="seats">จองเป็นที่นั่ง + ของแถม</option>
                <option value="none">เฉพาะของที่ระลึก (ไม่มีโต๊ะ — ขายได้เฉพาะ POS)</option>
              </select>
              {bookingType === "none" && (
                <span className="text-xs text-stone-400">
                  ไม่มีการจองโต๊ะ — ขายได้เฉพาะหน้างานผ่าน POS เท่านั้น (ไม่แสดงในหน้าจองออนไลน์)
                </span>
              )}
            </label>
            {bookingType !== "none" && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">จำนวนที่นั่ง *</span>
                <input
                  type="number"
                  min={1}
                  value={seatCount}
                  onChange={(e) => setSeatCount(e.target.value)}
                  className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2"
                />
                {bookingType === "full_table" && selectedEvent && (
                  <span className="text-xs text-stone-400">
                    {selectedEvent.tableCapacities.length > 0
                      ? `ต้องตรงกับความจุโต๊ะที่มีอยู่จริงในงานนี้ (${selectedEvent.tableCapacities.join(", ")} ที่นั่ง)`
                      : "งานนี้ยังไม่มีโต๊ะ — เพิ่มโต๊ะก่อนจึงจะสร้างแพ็กเกจแบบเหมาทั้งโต๊ะได้"}
                  </span>
                )}
              </label>
            )}
          </div>

          <div className="border-t border-cream-200 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-stone-700">สินค้าที่แถมในแพ็กเกจ *</span>
              <button type="button" onClick={addItemRow} className="text-xs text-maroon-700 hover:underline font-medium">
                + เพิ่มสินค้า
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => {
                const sizes = sizesFor(item.productId);
                const needsSizePicker = sizes.length > 1 || (sizes.length === 1 && sizes[0] !== "");
                return (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <select
                      value={item.productId}
                      onChange={(e) => updateItem(index, { productId: e.target.value, size: "", buyerChoosesSize: false })}
                      className="flex-1 min-w-[10rem] border border-stone-300 rounded-lg px-2 py-1.5 text-sm"
                    >
                      <option value="">-- เลือกสินค้า --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {needsSizePicker && !item.buyerChoosesSize && (
                      <select
                        value={item.size}
                        onChange={(e) => updateItem(index, { size: e.target.value })}
                        className="border border-stone-300 rounded-lg px-2 py-1.5 text-sm"
                      >
                        <option value="">-- ไซส์ --</option>
                        {sizes.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    )}
                    {needsSizePicker && (
                      <label className="flex items-center gap-1 text-xs text-stone-600 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={item.buyerChoosesSize}
                          onChange={(e) => updateItem(index, { buyerChoosesSize: e.target.checked, size: "" })}
                          className="accent-maroon-700"
                        />
                        ให้ลูกค้าเลือกไซส์เอง
                      </label>
                    )}
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: e.target.value })}
                      className="w-20 border border-stone-300 rounded-lg px-2 py-1.5 text-sm"
                    />
                    <button type="button" onClick={() => removeItemRow(index)} className="text-red-600 hover:underline text-xs">
                      ลบ
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg py-2 px-4 font-semibold disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "+ สร้างแพ็กเกจ"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="bg-white border border-stone-300 rounded-lg py-2 px-4 text-sm text-stone-700 hover:bg-cream-50"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-stone-400 py-10 text-center">กำลังโหลด...</div>
      ) : packages.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-cream-200 p-10 text-center text-stone-400 text-sm">
          ยังไม่มีแพ็กเกจ — เพิ่มแพ็กเกจแรกได้จากปุ่มด้านบน
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {packages.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-cream-200 shadow-md p-5 flex flex-col gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-display font-semibold text-stone-800">{p.name}</div>
                  {p.description && <div className="text-xs text-stone-400">{p.description}</div>}
                  <div className="text-xs text-stone-500 mt-0.5">
                    งาน: {p.event.name} ·{" "}
                    {p.bookingType === null
                      ? "เฉพาะของที่ระลึก (ไม่มีโต๊ะ — POS เท่านั้น)"
                      : p.bookingType === "full_table"
                      ? "จองทั้งโต๊ะ + ของแถม"
                      : `จอง ${p.seatCount} ที่นั่ง + ของแถม`}{" "}
                    · ขายแล้ว {p._count.reservations} ครั้ง
                  </div>
                  <div className="text-sm text-maroon-700 font-medium mt-0.5">{Number(p.price).toLocaleString()} บาท</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${p.active ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                    {p.active ? "เปิดขาย" : "ปิดขาย"}
                  </span>
                  <button onClick={() => toggleActive(p)} className="text-xs text-stone-600 hover:underline">
                    {p.active ? "ปิดการขาย" : "เปิดการขาย"}
                  </button>
                  <button onClick={() => startEdit(p)} className="text-xs text-maroon-700 hover:underline">
                    แก้ไข
                  </button>
                  <button onClick={() => deletePackage(p.id)} className="text-xs text-red-600 hover:underline">
                    ลบ
                  </button>
                </div>
              </div>
              <div className="border-t border-cream-200 pt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                {p.items.map((it) => (
                  <span key={it.id}>
                    {it.product.name}
                    {it.buyerChoosesSize ? " (ลูกค้าเลือกไซส์เอง)" : it.size ? ` (${it.size})` : ""} x{it.quantity}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
