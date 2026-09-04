"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteNav from "../components/site-nav";
import {
  validateNamePart,
  validateThaiPhone,
  formatThaiPhoneDisplay,
  cleanPhoneForStorage,
  isValidEmailFormat,
  normalizeEmail,
} from "@/lib/formValidation";

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

  // Name kept as two fields in the UI (per PDPA form-UX guidelines) but
  // combined into one "bookerName" string before it's sent — the
  // MerchOrder table's schema is a single bookerName column, unchanged.
  const [bookerFirstName, setBookerFirstName] = useState("");
  const [bookerLastName, setBookerLastName] = useState("");
  const [bookerPhone, setBookerPhone] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [consent, setConsent] = useState(false);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);
  const [done, setDone] = useState(false);
  const [orderCode, setOrderCode] = useState("");
  const [shippingFee, setShippingFee] = useState(0);

  useEffect(() => {
    fetch("/api/merch/products")
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.products || []);
        setShippingFee(Number(d.shippingFee) || 0);
      })
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

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const total = cart.length > 0 ? subtotal + shippingFee : 0;

  function validate(): boolean {
    const errs: Record<string, string> = {};

    const firstErr = validateNamePart(bookerFirstName, "ชื่อ");
    if (firstErr) errs.bookerFirstName = firstErr;
    const lastErr = validateNamePart(bookerLastName, "นามสกุล");
    if (lastErr) errs.bookerLastName = lastErr;

    const phoneErr = validateThaiPhone(bookerPhone);
    if (phoneErr) errs.bookerPhone = phoneErr;

    if (!bookerEmail.trim()) {
      errs.bookerEmail = "กรุณากรอกอีเมล";
    } else if (!isValidEmailFormat(bookerEmail)) {
      errs.bookerEmail = "รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
    }

    if (!shippingAddress.trim()) {
      errs.shippingAddress = "กรุณากรอกที่อยู่สำหรับจัดส่ง";
    }
    if (!slipFile) {
      errs.slipFile = "กรุณาแนบไฟล์สลิปโอนเงิน";
    }
    if (!consent) {
      errs.consent = "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสั่งซื้อ";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (cart.length === 0) {
      setError("กรุณาเพิ่มสินค้าลงตะกร้าก่อนสั่งซื้อ");
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      const bookerName = `${bookerFirstName.trim()} ${bookerLastName.trim()}`.trim();
      const cleanedPhone = cleanPhoneForStorage(bookerPhone);
      const cleanedEmail = normalizeEmail(bookerEmail);
      const formData = new FormData();
      formData.append("bookerName", bookerName);
      formData.append("bookerPhone", cleanedPhone);
      formData.append("bookerEmail", cleanedEmail);
      formData.append("shippingAddress", shippingAddress);
      formData.append(
        "items",
        JSON.stringify(
          cart.map((line) => ({
            productId: line.productId,
            size: line.size,
            quantity: line.quantity,
          }))
        )
      );
      formData.append("file", slipFile as File);

      const res = await fetch("/api/merch/orders", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        // OUT_OF_STOCK can still happen here even after client-side checks
        // (someone else bought the last unit in the meantime) — the server
        // is always the final authority.
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }
      setOrderCode(data.orderCode);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div>
        <SiteNav />
        <main className="max-w-md mx-auto p-6 text-center bg-white border border-cream-200 rounded-xl shadow-md space-y-3 mt-4">
          <h1 className="text-xl font-display font-semibold text-emerald-600 mb-2">สั่งซื้อและส่งสลิปสำเร็จ</h1>
          <p className="text-stone-600 mb-1">รหัสการสั่งซื้อของท่านคือ {orderCode}</p>
          <p className="text-sm text-stone-500 mb-4">
            เจ้าหน้าที่จะตรวจสอบสลิปการโอนเงินโดยเร็วที่สุด ท่านสามารถตรวจสอบสถานะได้ที่หน้าตรวจสอบคำสั่งซื้อ
          </p>
          <button
            onClick={() => router.push(`/merch/status?orderCode=${orderCode}&phone=${encodeURIComponent(cleanPhoneForStorage(bookerPhone))}`)}
            className="bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg px-4 py-2 font-medium"
          >
            เช็คสถานะคำสั่งซื้อ
          </button>
        </main>
      </div>
    );
  }

  return (
    <div>
      <SiteNav />

      <section className="relative overflow-hidden bg-maroon-700">
        <div className="relative max-w-6xl mx-auto px-4 py-12 sm:py-16 text-center">
          <span className="inline-block text-xs font-medium tracking-wide uppercase bg-white/10 text-primary-200 rounded-full px-3 py-1 mb-4 border border-primary-400/30">
            ของที่ระลึกงานคืนสู่เหย้า
          </span>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-white leading-snug">สั่งซื้อของที่ระลึก</h1>
          <p className="mt-3 text-cream-50/80 max-w-xl mx-auto">เลือกซื้อเสื้อ เหรียญ และของที่ระลึกอื่นๆ ของศิษย์เก่า พร้อมจัดส่งถึงบ้าน</p>
        </div>
      </section>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
      {loading && <p className="text-stone-500">กำลังโหลด...</p>}
      {!loading && products.length === 0 && <p className="text-stone-500">ยังไม่มีสินค้าเปิดขายในขณะนี้</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {products.map((p) => {
          const sel = getSelection(p);
          const selectedSize = p.requiresSize ? sel.size : "";
          const remaining = stockFor(p, selectedSize) - inCartQty(p.id, p.requiresSize ? selectedSize : undefined);
          const anyStock = p.requiresSize ? SIZES.some((s) => stockFor(p, s) > 0) : stockFor(p, "") > 0;
          return (
            <div key={p.id} className="bg-white rounded-xl border border-cream-200 shadow-md hover:shadow-md transition-shadow p-4 flex flex-col gap-2">
              {p.imageUrl ? (
                <button
                  type="button"
                  onClick={() => setLightbox({ url: p.imageUrl!, alt: p.name })}
                  className="block w-full cursor-zoom-in"
                  aria-label={`ดูภาพขยายของ ${p.name}`}
                >
                  <img src={p.imageUrl} alt={p.name} className="w-full h-40 object-cover rounded-lg" />
                </button>
              ) : (
                <div className="w-full h-40 bg-cream-100 rounded-lg flex items-center justify-center text-stone-400 text-sm">
                  ไม่มีรูปภาพ
                </div>
              )}
              <h2 className="font-display font-semibold text-stone-800">{p.name}</h2>
              {p.description && <p className="text-sm text-stone-500">{p.description}</p>}
              <p className="font-semibold text-maroon-700">{Number(p.price).toLocaleString()} บาท</p>

              {!anyStock && (
                <p className="text-sm font-medium text-red-600">สินค้าหมด</p>
              )}

              {anyStock && p.requiresSize && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-stone-700">ไซส์</span>
                  <select
                    value={sel.size}
                    onChange={(e) => updateSelection(p.id, { size: e.target.value })}
                    className="border border-stone-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500"
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
                    <span className="font-medium text-stone-700">จำนวน {!p.requiresSize && `(เหลือ ${stockFor(p, "")})`}</span>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, remaining)}
                      value={sel.quantity}
                      onChange={(e) => updateSelection(p.id, { quantity: Number(e.target.value) })}
                      className="border border-stone-300 rounded-lg px-2 py-1.5 w-24 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500"
                    />
                  </label>

                  <button
                    onClick={() => addToCart(p)}
                    disabled={remaining <= 0}
                    className="mt-1 bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg py-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {remaining <= 0 ? "หมด" : "+ เพิ่มลงตะกร้า"}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-2">
        <h2 className="font-display font-semibold text-stone-800">ตะกร้าสินค้า</h2>
        {cart.length === 0 && <p className="text-sm text-stone-400">ยังไม่มีสินค้าในตะกร้า</p>}
        <div className="flex flex-col gap-2">
          {cart.map((line, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-cream-200 pb-2">
              <div>
                <span className="font-medium text-stone-800">{line.name}</span>
                {line.size && <span className="text-stone-400"> · ไซส์ {line.size}</span>}
                <span className="text-stone-400"> × {line.quantity}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-stone-700">{(line.unitPrice * line.quantity).toLocaleString()} บาท</span>
                <button onClick={() => removeLine(i)} className="text-red-600 hover:text-red-700 hover:underline text-xs">
                  ลบ
                </button>
              </div>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="pt-2 space-y-1">
            <div className="flex justify-between text-sm text-stone-600">
              <span>ยอดสินค้า</span>
              <span>{subtotal.toLocaleString()} บาท</span>
            </div>
            <div className="flex justify-between text-sm text-stone-600">
              <span>ค่าจัดส่ง</span>
              <span>{shippingFee.toLocaleString()} บาท</span>
            </div>
            <div className="flex justify-between font-semibold text-stone-800 border-t border-cream-200 pt-1">
              <span>รวมทั้งหมด</span>
              <span>{total.toLocaleString()} บาท</span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={checkout} noValidate className="bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-3">
        <h2 className="font-display font-semibold text-stone-800">ข้อมูลผู้สั่งซื้อ</h2>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-stone-700">
              ชื่อผู้สั่ง <span className="text-red-600">*</span>
            </span>
            <input
              value={bookerFirstName}
              onChange={(e) => setBookerFirstName(e.target.value)}
              autoComplete="given-name"
              maxLength={100}
              className={`border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-shadow ${fieldErrors.bookerFirstName ? "border-red-400 focus:ring-red-300 focus:border-red-500" : "border-stone-300 focus:ring-primary-400 focus:border-primary-500"}`}
            />
            {fieldErrors.bookerFirstName && <span className="text-xs text-red-600">{fieldErrors.bookerFirstName}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-stone-700">
              นามสกุลผู้สั่ง <span className="text-red-600">*</span>
            </span>
            <input
              value={bookerLastName}
              onChange={(e) => setBookerLastName(e.target.value)}
              autoComplete="family-name"
              maxLength={100}
              className={`border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-shadow ${fieldErrors.bookerLastName ? "border-red-400 focus:ring-red-300 focus:border-red-500" : "border-stone-300 focus:ring-primary-400 focus:border-primary-500"}`}
            />
            {fieldErrors.bookerLastName && <span className="text-xs text-red-600">{fieldErrors.bookerLastName}</span>}
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-stone-700">
            เบอร์โทรศัพท์ <span className="text-red-600">*</span>
          </span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={bookerPhone}
            onChange={(e) => setBookerPhone(formatThaiPhoneDisplay(e.target.value))}
            placeholder="08X-XXX-XXXX"
            className={`border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-shadow ${fieldErrors.bookerPhone ? "border-red-400 focus:ring-red-300 focus:border-red-500" : "border-stone-300 focus:ring-primary-400 focus:border-primary-500"}`}
          />
          {fieldErrors.bookerPhone && <span className="text-xs text-red-600">{fieldErrors.bookerPhone}</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-stone-700">
            อีเมล <span className="text-red-600">*</span>
          </span>
          <input
            type="email"
            autoComplete="email"
            autoCapitalize="off"
            autoCorrect="off"
            value={bookerEmail}
            onChange={(e) => setBookerEmail(e.target.value)}
            onBlur={(e) => setBookerEmail(normalizeEmail(e.target.value))}
            className={`border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-shadow ${fieldErrors.bookerEmail ? "border-red-400 focus:ring-red-300 focus:border-red-500" : "border-stone-300 focus:ring-primary-400 focus:border-primary-500"}`}
          />
          {fieldErrors.bookerEmail && <span className="text-xs text-red-600">{fieldErrors.bookerEmail}</span>}
          <p className="text-xs text-stone-400">ใช้แจ้งสถานะและติดต่อกลับเรื่องการสั่งซื้อ</p>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-stone-700">
            ที่อยู่สำหรับจัดส่ง <span className="text-red-600">*</span>
          </span>
          <textarea
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            autoComplete="street-address"
            className={`border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-shadow ${fieldErrors.shippingAddress ? "border-red-400 focus:ring-red-300 focus:border-red-500" : "border-stone-300 focus:ring-primary-400 focus:border-primary-500"}`}
            rows={3}
            placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด รหัสไปรษณีย์"
          />
          {fieldErrors.shippingAddress && <span className="text-xs text-red-600">{fieldErrors.shippingAddress}</span>}
        </label>

        <label className="flex flex-col gap-1 text-sm border-t border-cream-200 pt-3">
          <span className="font-medium text-stone-700">
            ไฟล์สลิปโอนเงิน <span className="text-red-600">*</span>
          </span>
          <span className="text-xs text-stone-400">กรุณาโอนเงินตามยอดรวมด้านบนแล้วแนบรูปสลิปที่นี่ ระบบจะบันทึกคำสั่งซื้อและส่งสลิปให้เจ้าหน้าที่ตรวจสอบในขั้นตอนเดียวกัน</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
            className={`border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-shadow ${fieldErrors.slipFile ? "border-red-400 focus:ring-red-300 focus:border-red-500" : "border-stone-300 focus:ring-primary-400 focus:border-primary-500"}`}
          />
          {fieldErrors.slipFile && <span className="text-xs text-red-600">{fieldErrors.slipFile}</span>}
        </label>

        <div className="border-t border-cream-200 pt-3">
          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="accent-maroon-700 mt-0.5"
            />
            <span>
              ข้าพเจ้ายินยอมให้เก็บและใช้ข้อมูลตาม{" "}
              <Link href="/privacy" target="_blank" className="text-maroon-700 underline hover:text-maroon-800">
                นโยบายความเป็นส่วนตัว
              </Link>{" "}
              <span className="text-red-600">*</span>
            </span>
          </label>
          {fieldErrors.consent && <p className="text-xs text-red-600 mt-1">{fieldErrors.consent}</p>}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || cart.length === 0}
          className="w-full bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg py-2.5 font-semibold disabled:opacity-50"
        >
          {submitting ? "กำลังส่งข้อมูล..." : "สั่งซื้อและส่งสลิป"}
        </button>
      </form>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out overflow-auto"
        >
          <img
            src={lightbox.url}
            alt={lightbox.alt}
            // Native pinch-to-zoom on mobile works because the image sits in
            // a scrollable overlay; on desktop it's just shown large. Stop
            // the click from bubbling to the backdrop so tapping the image
            // itself doesn't close the lightbox.
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full sm:max-w-[90vw] sm:max-h-[90vh] object-contain rounded-lg"
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="ปิด"
            className="fixed top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full w-10 h-10 flex items-center justify-center text-xl"
          >
            ×
          </button>
        </div>
      )}
      </main>
    </div>
  );
}
