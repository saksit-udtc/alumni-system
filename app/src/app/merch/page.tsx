"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteNav from "../components/site-nav";
import PageTitle from "@/app/components/page-title";
import PayQr from "../components/pay-qr";
import { ShopProduct, SIZES, StockBadge, ProductModal, totalStock } from "./shop-parts";
import { generatePromptPayPayload } from "@/lib/promptpay";
import {
  validateNamePart,
  validateThaiPhone,
  formatThaiPhoneDisplay,
  cleanPhoneForStorage,
  isValidEmailFormat,
  normalizeEmail,
} from "@/lib/formValidation";

type Product = ShopProduct;

interface CartLine {
  productId: string;
  name: string;
  size?: string;
  quantity: number;
  unitPrice: number;
}

const SLIP_MAX_BYTES = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const slipInputRef = useRef<HTMLInputElement>(null);
  const [slipPreviewUrl, setSlipPreviewUrl] = useState<string | null>(null);
  const [slipPreviewFailed, setSlipPreviewFailed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // เมื่อกดส่งครั้งแรกแล้ว จะตรวจซ้ำแบบสดทุกครั้งที่แก้ข้อมูล เพื่อให้ข้อความแดงหายทันทีเมื่อกรอกถูก
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<{ url: string; alt: string; pair?: { front: string; back: string } } | null>(null);
  // ภาพขยายแบบมีด้านหน้า/หลัง: คลิกที่ภาพเพื่อพลิก (หดแนวนอน → เปลี่ยนรูป → ขยายกลับ)
  const [lightboxFlipping, setLightboxFlipping] = useState(false);
  function flipLightbox() {
    if (!lightbox?.pair || lightboxFlipping) return;
    const { front, back } = lightbox.pair;
    setLightboxFlipping(true);
    setTimeout(() => {
      setLightbox((lb) => (lb ? { ...lb, url: lb.url === back ? front : back } : lb));
      setLightboxFlipping(false);
    }, 160);
  }
  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);
  // Product currently open in the detail modal (null = closed).
  const [detailId, setDetailId] = useState<string | null>(null);
  // Short confirmation shown after adding to cart.
  const [toast, setToast] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  // True while the checkout form is on screen — the floating cart bar hides
  // itself then, since the form already shows the same totals.
  const [formInView, setFormInView] = useState(false);
  const [done, setDone] = useState(false);
  const [orderCode, setOrderCode] = useState("");
  const [shippingFee, setShippingFee] = useState(0);
  // Same PromptPay setting the POS payment screen and table-booking form
  // use (lib/settings.ts) — purely a convenience QR for the customer to
  // scan-and-pay, the slip-upload + admin-verify flow is unchanged.
  const [promptPayId, setPromptPayId] = useState("");
  // Merch-only "แพ็กเกจสุดคุ้ม" bundles (bookingType null — no table) sold
  // online only, alongside the regular product grid below — see
  // lib/createMerchPackageOrder.ts and /merch/package/[id].
  const [merchPackages, setMerchPackages] = useState<
    { id: string; name: string; description: string | null; price: number; imageUrl: string | null }[]
  >([]);

  useEffect(() => {
    fetch("/api/merch/products")
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.products || []);
        setShippingFee(Number(d.shippingFee) || 0);
      })
      .finally(() => setLoading(false));
    fetch("/api/settings/promptpay")
      .then((r) => r.json())
      .then((d) => setPromptPayId(d.promptPayId || ""))
      .catch(() => {});
    fetch("/api/merch/packages")
      .then((r) => r.json())
      .then((d) => setMerchPackages(d.packages || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const el = formRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setFormInView(entry.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [done, loading, cart.length > 0]);

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
    // Same product + size already in the cart -> bump that line instead of
    // adding a duplicate row.
    setCart((prev) => {
      const i = prev.findIndex((l) => l.productId === p.id && (l.size || "") === (size || ""));
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + quantity };
        return next;
      }
      return [...prev, { productId: p.id, name: p.name, size, quantity, unitPrice: Number(p.price) }];
    });
    updateSelection(p.id, { quantity: 1 });
    setToast(`เพิ่ม ${p.name}${size ? ` (${size})` : ""} ×${quantity} ลงตะกร้าแล้ว`);
  }

  function remainingForSize(p: Product, size: string) {
    return stockFor(p, size) - inCartQty(p.id, p.requiresSize ? size : undefined);
  }

  function removeLine(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  const detailProduct = detailId ? products.find((p) => p.id === detailId) ?? null : null;
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const total = cart.length > 0 ? subtotal + shippingFee : 0;

  const promptPayPayload = useMemo(() => {
    if (!promptPayId || total <= 0) return null;
    try {
      return generatePromptPayPayload(promptPayId, total);
    } catch {
      return null;
    }
  }, [promptPayId, total]);

  // "รายการ" line shown under the QR — purely descriptive (never sent
  // anywhere), so whoever is paying (or reviewing the payment later) can
  // see what the amount covers without scrolling back up to the cart.
  const cartSummary = cart.map((l) => `${l.name}${l.size ? ` (${l.size})` : ""} x${l.quantity}`).join(", ");

  function computeErrors(): Record<string, string> {
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
    } else if (slipFile.type && !slipFile.type.startsWith("image/") && slipFile.type !== "application/pdf") {
      errs.slipFile = "รองรับเฉพาะไฟล์รูปภาพหรือ PDF เท่านั้น";
    } else if (slipFile.size === 0) {
      errs.slipFile = "ไฟล์ว่างเปล่า กรุณาเลือกไฟล์สลิปใหม่";
    } else if (slipFile.size > SLIP_MAX_BYTES) {
      errs.slipFile = `ไฟล์ใหญ่เกินไป (${formatFileSize(slipFile.size)}) ขนาดต้องไม่เกิน 10 MB`;
    }
    if (!consent) {
      errs.consent = "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสั่งซื้อ";
    }

    return errs;
  }

  function validate(): boolean {
    const errs = computeErrors();
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  useEffect(() => {
    setSlipPreviewFailed(false);
    if (!slipFile || !slipFile.type.startsWith("image/")) {
      setSlipPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(slipFile);
    setSlipPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [slipFile]);

  function clearSlip() {
    setSlipFile(null);
    if (slipInputRef.current) slipInputRef.current.value = "";
  }

  useEffect(() => {
    if (submitted) setFieldErrors(computeErrors());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, bookerFirstName, bookerLastName, bookerPhone, bookerEmail, shippingAddress, slipFile, consent]);

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (cart.length === 0) {
      setError("กรุณาเพิ่มสินค้าลงตะกร้าก่อนสั่งซื้อ");
      return;
    }
    setSubmitted(true);
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
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            ระบบส่งอีเมลยืนยันไปที่ {bookerEmail} แล้ว หากไม่พบอีเมลในกล่องจดหมายเข้า กรุณาตรวจสอบในโฟลเดอร์อีเมลขยะ (Junk/Spam)
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

      <PageTitle title="สั่งซื้อของที่ระลึก" />

      <main className={`max-w-5xl mx-auto p-4 space-y-6 ${cart.length > 0 ? "pb-28" : ""}`}>
      {loading && <p className="text-stone-500">กำลังโหลด...</p>}
      {!loading && products.length === 0 && merchPackages.length === 0 && <p className="text-stone-500">ยังไม่มีสินค้าเปิดขายในขณะนี้</p>}

      {/* มือถือ 2×2, จอใหญ่ 4 คอลัมน์ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {products.map((p) => {
          const soldOut = totalStock(p) <= 0;
          const quickRemaining = remainingForSize(p, "");
          return (
            <div key={p.id} className="bg-white rounded-xl border border-cream-200 shadow-md hover:shadow-lg transition-shadow overflow-hidden flex flex-col">
              <button
                type="button"
                onClick={() => setDetailId(p.id)}
                className="relative block w-full text-left"
                aria-label={`ดูรายละเอียด ${p.name}`}
              >
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className={`w-full aspect-square object-cover ${soldOut ? "opacity-50 grayscale" : ""}`} />
                ) : (
                  <div className="w-full aspect-square bg-cream-100 flex items-center justify-center text-stone-400 text-sm">ไม่มีรูปภาพ</div>
                )}
                <div className="absolute top-2 left-2">
                  <StockBadge product={p} />
                </div>
              </button>
              <div className="p-2 sm:p-3 flex flex-col gap-1 flex-1">
                <button
                  type="button"
                  onClick={() => setDetailId(p.id)}
                  className="text-left text-sm sm:text-base leading-snug font-display font-semibold text-stone-800 hover:text-maroon-700 transition-colors"
                >
                  {p.name}
                </button>
                {p.description && <p className="hidden sm:block text-xs text-stone-500 line-clamp-2">{p.description}</p>}
                <p className="text-sm sm:text-base font-semibold text-maroon-700">{Number(p.price).toLocaleString()} บาท</p>
                <div className="mt-auto pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailId(p.id)}
                    className="hidden sm:block flex-1 border border-stone-300 hover:border-maroon-700 hover:text-maroon-700 transition-colors text-stone-600 rounded-lg py-2 text-sm font-medium"
                  >
                    รายละเอียด
                  </button>
                  {!soldOut &&
                    (p.requiresSize ? (
                      <button
                        type="button"
                        onClick={() => setDetailId(p.id)}
                        className="flex-1 bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg py-2 text-sm font-semibold"
                      >
                        เลือกไซส์
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToCart(p)}
                        disabled={quickRemaining <= 0}
                        className="flex-1 bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {quickRemaining > 0 ? "+ ตะกร้า" : "ครบแล้ว"}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          );
        })}
        {/* Merch-only packages ("แพ็กเกจสุดคุ้ม") — appended after the
            regular products, same card layout as a normal product (image,
            name, price, action button), so the two read as one continuous
            shop grid. A package always links out to its own purchase page
            (/merch/package/[id]) instead of adding to this page's cart. */}
        {merchPackages.map((p) => (
          <Link
            key={p.id}
            href={`/merch/package/${p.id}`}
            className="bg-white rounded-xl border border-cream-200 shadow-md hover:shadow-lg transition-shadow overflow-hidden flex flex-col"
          >
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.name} className="w-full aspect-square object-cover" />
            ) : (
              <div className="w-full aspect-square bg-cream-100 flex items-center justify-center text-stone-400 text-sm">ไม่มีรูปภาพ</div>
            )}
            <div className="p-2 sm:p-3 flex flex-col gap-1 flex-1">
              <span className="text-left text-sm sm:text-base leading-snug font-display font-semibold text-stone-800">{p.name}</span>
              {p.description && <p className="hidden sm:block text-xs text-stone-500 line-clamp-2">{p.description}</p>}
              <p className="text-sm sm:text-base font-semibold text-maroon-700">{Number(p.price).toLocaleString()} บาท</p>
              <div className="mt-auto pt-2">
                <span className="block text-center bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg py-2 text-sm font-semibold">
                  ดูแพ็กเกจ
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="max-w-3xl mx-auto w-full bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-2">
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

      <form ref={formRef} id="checkout-form" onSubmit={checkout} noValidate className="max-w-3xl mx-auto w-full bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-3">
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
          <p className="text-xs text-stone-400">ใช้แจ้งสถานะและติดต่อกลับเรื่องการสั่งซื้อ (หากไม่พบอีเมลในกล่องจดหมายเข้า กรุณาตรวจสอบในโฟลเดอร์อีเมลขยะ (Junk/Spam))</p>
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

        {promptPayPayload && (
          <PayQr value={promptPayPayload} amount={total} label={cartSummary} size={180} boxClassName="border-t-cream-200 mt-1" />
        )}

        <label className="flex flex-col gap-1 text-sm border-t border-cream-200 pt-3">
          <span className="font-medium text-stone-700">
            ไฟล์สลิปโอนเงิน <span className="text-red-600">*</span>
          </span>
          <span className="text-xs text-stone-400">กรุณาโอนเงินตามยอดรวมด้านบนแล้วแนบรูปสลิปที่นี่ ระบบจะบันทึกคำสั่งซื้อและส่งสลิปให้เจ้าหน้าที่ตรวจสอบในขั้นตอนเดียวกัน</span>
          <input
            ref={slipInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
            className={`border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-shadow ${fieldErrors.slipFile ? "border-red-400 focus:ring-red-300 focus:border-red-500" : "border-stone-300 focus:ring-primary-400 focus:border-primary-500"}`}
          />
          {fieldErrors.slipFile && <span className="text-xs text-red-600">{fieldErrors.slipFile}</span>}

          {slipFile && (
            <div className="mt-2 flex items-start gap-3 rounded-lg border border-cream-200 bg-cream-50 p-2">
              {slipPreviewUrl && !slipPreviewFailed ? (
                <a href={slipPreviewUrl} target="_blank" rel="noopener noreferrer" title="คลิกเพื่อดูรูปขนาดเต็ม" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slipPreviewUrl}
                    alt="ตัวอย่างสลิปที่เลือก"
                    onError={() => setSlipPreviewFailed(true)}
                    className="h-40 w-auto max-w-[9rem] rounded border border-stone-200 bg-white object-contain"
                  />
                </a>
              ) : (
                <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded border border-stone-200 bg-white text-xs font-semibold text-stone-500">
                  {slipFile.type === "application/pdf" ? "PDF" : "ไฟล์"}
                </div>
              )}
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium text-stone-700" title={slipFile.name}>
                  {slipFile.name}
                </p>
                <p className="text-xs text-stone-500">{formatFileSize(slipFile.size)}</p>
                {slipPreviewFailed && <p className="mt-1 text-xs text-stone-400">ไม่สามารถแสดงตัวอย่างไฟล์ชนิดนี้ได้ แต่ยังส่งได้ตามปกติ</p>}
                {!fieldErrors.slipFile && <p className="mt-1 text-xs text-emerald-600">พร้อมส่ง — ตรวจให้แน่ใจว่าเห็นยอดเงินและวันที่ชัดเจน</p>}
                <button type="button" onClick={clearSlip} className="mt-1 text-xs text-red-600 underline hover:text-red-700">
                  ลบไฟล์
                </button>
              </div>
            </div>
          )}
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

      {detailProduct && (
        <ProductModal
          product={detailProduct}
          size={getSelection(detailProduct).size}
          quantity={getSelection(detailProduct).quantity}
          remainingFor={(size) => remainingForSize(detailProduct, size)}
          onSize={(size) => updateSelection(detailProduct.id, { size })}
          onQty={(quantity) => updateSelection(detailProduct.id, { quantity })}
          onAdd={() => addToCart(detailProduct)}
          onClose={() => setDetailId(null)}
          onZoom={(url, alt, pair) => setLightbox({ url, alt, pair })}
          escapeDisabled={!!lightbox}
        />
      )}

      {cart.length > 0 && !formInView && !detailProduct && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-cream-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium text-stone-800">
                ตะกร้า {cartCount} ชิ้น · รวม {total.toLocaleString()} บาท
              </div>
              <div className="text-xs text-stone-400">รวมค่าจัดส่งแล้ว</div>
            </div>
            <button
              type="button"
              onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg px-4 py-2.5 font-semibold text-sm whitespace-nowrap"
            >
              ไปชำระเงิน
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed left-1/2 -translate-x-1/2 z-[60] bg-stone-800 text-white text-sm rounded-full px-4 py-2 shadow-lg max-w-[90vw] text-center ${cart.length > 0 && !formInView && !detailProduct ? "bottom-24" : "bottom-6"}`}
        >
          {toast}
        </div>
      )}

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[58] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out overflow-auto"
        >
          {lightbox.pair ? (
            <div className="w-full max-w-[min(92vw,86vh)] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={flipLightbox}
                className="block w-full bg-white rounded-2xl shadow-2xl cursor-pointer"
                aria-label={`พลิกดู${lightbox.url === lightbox.pair.back ? "ด้านหน้า" : "ด้านหลัง"}`}
              >
                <img
                  src={lightbox.url}
                  alt={`${lightbox.alt} (${lightbox.url === lightbox.pair.back ? "ด้านหลัง" : "ด้านหน้า"})`}
                  className="w-full aspect-square object-contain p-4 sm:p-6 transition-transform duration-150 ease-in-out motion-reduce:transition-none"
                  style={{ transform: lightboxFlipping ? "scaleX(0)" : "scaleX(1)" }}
                />
              </button>
              <p className="mt-3 text-white text-sm text-center">
                {lightbox.url === lightbox.pair.back ? "ด้านหลัง" : "ด้านหน้า"} · แตะที่ภาพเพื่อพลิกดูอีกด้าน
              </p>
            </div>
          ) : (
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
          )}
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
