"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string;
  requiresSize: boolean;
  imageUrl: string | null;
  // "" -> qty for non-sized products; per-size key otherwise. A missing
  // key means 0 in stock, same as an explicit 0.
  stock: Record<string, number>;
}

interface CartLine {
  productId: string;
  name: string;
  size?: string;
  quantity: number;
  unitPrice: number;
}

const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

export default function MerchShopPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<Record<string, { size: string; quantity: number }>>({});
  const [cart, setCart] = useState<CartLine[]>([]);

  const [bookerName, setBookerName] = useState("");
  const [bookerPhone, setBookerPhone] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/merch/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .finally(() => setLoading(false));
  }, []);

  function stockFor(p: Product, size: string) {
    return p.stock?.[size] ?? 0;
  }

  function inCartQty(productId: string, size: string | undefined) {
    return cart
      .filter((l) => l.productId === productId && (l.size || "") === (size || ""))
      .reduce((sum, l) => sum + l.quantity, 0);
  }

  function defaultSize(p: Product) {
    return SIZES.find((s) => stockFor(p, s) > 0) || SIZES[0];
  }

  function getSelection(p: Product) {
    return selections[p.id] || { size: defaultSize(p), quantity: 1 };
  }

  function updateSelection(productId: string, patch: Partial<{ size: string; quantity: number }>) {
    const product = products.find((p) => p.id === productId);
    setSelections((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] || { size: product ? defaultSize(product) : SIZES[0], quantity: 1 }), ...patch },
    }));
  }

  function addToCart(p: Product) {
    const sel = getSelection(p);
    const size = p.requiresSize ? sel.size : undefined;
    const remaining = stockFor(p, size || "") - inCartQty(p.id, size);
    if (remaining <= 0) return;
    const quantity = Math.max(1, Math.min(Number(sel.quantity) || 1, remaining));
    setCart((prev) => [
      ...prev,
      {
        productId: p.id,
        name: p.name,
        size,
        quantity,
        unitPrice: Number(p.price),
      },
    ]);
  }

  function removeLine(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (cart.length === 0) {
      setError("กรุณาเพิ่มสินค้าลงตะกร้าก่อนสั่งซื้อ");
      return;
    }
    if (!bookerName.trim() || !bookerPhone.trim()) {
      setError("กรุณากรอกชื่อผู้สั่งและเบอร์โทรศัพท์");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/merch/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookerName,
          bookerPhone,
          bookerEmail,
          items: cart.map((line) => ({
            productId: line.productId,
            size: line.size,
            quantity: line.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // OUT_OF_STOCK can still happen here even after client-side checks
        // (someone else bought the last unit in the meantime) — the server
        // is always the final authority.
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }
      router.push(`/merch/orders/${data.orderCode}/upload-slip?phone=${encodeURIComponent(bookerPhone)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-primary-700">สั่งซื้อของที่ระลึก</h1>

      {loading && <p>กำลังโหลด...</p>}
      {!loading && products.length === 0 && <p className="text-gray-500">ยังไม่มีสินค้าเปิดขายในขณะนี้</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {products.map((p) => {
          const sel = getSelection(p);
          const selectedSize = p.requiresSize ? sel.size : "";
          const remaining = stockFor(p, selectedSize) - inCartQty(p.id, p.requiresSize ? selectedSize : undefined);
          const anyStock = p.requiresSize ? SIZES.some((s) => stockFor(p, s) > 0) : stockFor(p, "") > 0;
          return (
            <div key={p.id} className="bg-white rounded-xl shadow p-4 flex flex-col gap-2">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-full h-40 object-cover rounded-lg" />
              ) : (
                <div className="w-full h-40 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-sm">
                  ไม่มีรูปภาพ
                </div>
              )}
              <h2 className="font-semibold">{p.name}</h2>
              {p.description && <p className="text-sm text-gray-500">{p.description}</p>}
              <p className="font-semibold text-primary-700">{Number(p.price).toLocaleString()} บาท</p>

              {!anyStock && (
                <p className="text-sm font-medium text-red-500">สินค้าหมด</p>
              )}

              {anyStock && p.requiresSize && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">ไซส์</span>
                  <select
                    value={sel.size}
                    onChange={(e) => updateSelection(p.id, { size: e.target.value })}
                    className="border rounded px-2 py-1"
                  >
                    {SIZES.map((s) => (
                      <option key={s} value={s} disabled={stockFor(p, s) === 0}>
                        {s} {stockFor(p, s) === 0 ? "(หมด)" : `(เหลือ ${stockFor(p, s)})`}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {anyStock && (
                <>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">จำนวน {!p.requiresSize && `(เหลือ ${stockFor(p, "")})`}</span>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, remaining)}
                      value={sel.quantity}
                      onChange={(e) => updateSelection(p.id, { quantity: Number(e.target.value) })}
                      className="border rounded px-2 py-1 w-24"
                    />
                  </label>

                  <button
                    onClick={() => addToCart(p)}
                    disabled={remaining <= 0}
                    className="mt-1 bg-primary-600 hover:bg-primary-700 text-white rounded py-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {remaining <= 0 ? "หมด" : "+ เพิ่มลงตะกร้า"}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-2">
        <h2 className="font-semibold">ตะกร้าสินค้า</h2>
        {cart.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีสินค้าในตะกร้า</p>}
        <div className="flex flex-col gap-2">
          {cart.map((line, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm border-b pb-2">
              <div>
                <span className="font-medium">{line.name}</span>
                {line.size && <span className="text-gray-400"> · ไซส์ {line.size}</span>}
                <span className="text-gray-400"> × {line.quantity}</span>
              </div>
              <div className="flex items-center gap-3">
                <span>{(line.unitPrice * line.quantity).toLocaleString()} บาท</span>
                <button onClick={() => removeLine(i)} className="text-red-500 hover:underline text-xs">
                  ลบ
                </button>
              </div>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="flex justify-between font-semibold pt-2">
            <span>รวมทั้งหมด</span>
            <span>{total.toLocaleString()} บาท</span>
          </div>
        )}
      </div>

      <form onSubmit={checkout} className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">ข้อมูลผู้สั่งซื้อ</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">ชื่อผู้สั่ง *</span>
          <input
            value={bookerName}
            onChange={(e) => setBookerName(e.target.value)}
            className="border rounded px-3 py-2"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">เบอร์โทรศัพท์ *</span>
          <input
            value={bookerPhone}
            onChange={(e) => setBookerPhone(e.target.value)}
            className="border rounded px-3 py-2"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">อีเมล (ไม่บังคับ)</span>
          <input
            value={bookerEmail}
            onChange={(e) => setBookerEmail(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || cart.length === 0}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded py-2 font-semibold disabled:opacity-50"
        >
          {submitting ? "กำลังสั่งซื้อ..." : "สั่งซื้อ"}
        </button>
      </form>
    </main>
  );
}
