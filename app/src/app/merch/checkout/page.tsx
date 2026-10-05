"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteNav from "../../components/site-nav";
import PageTitle from "@/app/components/page-title";
import { PENDING_HOLD_MINUTES } from "@/lib/holdPolicy";
import { useMerchCart } from "@/lib/merch-cart";
import {
  validateNamePart,
  validateThaiPhone,
  formatThaiPhoneDisplay,
  cleanPhoneForStorage,
  isValidEmailFormat,
  normalizeEmail,
} from "@/lib/formValidation";

export default function MerchCheckoutPage() {
  const router = useRouter();
  const { cart, ready, clear: clearCart } = useMerchCart();
  const [bookerFirstName, setBookerFirstName] = useState("");
  const [bookerLastName, setBookerLastName] = useState("");
  const [bookerPhone, setBookerPhone] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [consent, setConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // เมื่อกดส่งครั้งแรกแล้ว จะตรวจซ้ำแบบสดทุกครั้งที่แก้ข้อมูล เพื่อให้ข้อความแดงหายทันทีเมื่อกรอกถูก
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [orderCode, setOrderCode] = useState("");
  const [shippingFee, setShippingFee] = useState(0);
  // Same PromptPay setting the POS payment screen and table-booking form use

  useEffect(() => {
    fetch("/api/merch/products")
      .then((r) => r.json())
      .then((d) => setShippingFee(Number(d.shippingFee) || 0))
      .catch(() => {});
  }, []);

  // ตะกร้าว่าง (และยังไม่ได้สั่งซื้อสำเร็จ) -> กลับไปหน้าตะกร้า
  useEffect(() => {
    if (ready && cart.length === 0 && !done) router.replace("/merch/cart");
  }, [ready, cart.length, done, router]);

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const total = cart.length > 0 ? subtotal + shippingFee : 0;

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
    if (submitted) setFieldErrors(computeErrors());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, bookerFirstName, bookerLastName, bookerPhone, bookerEmail, shippingAddress, consent]);

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
      clearCart();
      router.push(`/merch/orders/${data.orderCode}/upload-slip?phone=${encodeURIComponent(cleanedPhone)}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div>
        <SiteNav />
        <main className="max-w-md mx-auto p-6 text-center text-stone-600">กำลังไปหน้าชำระเงิน...</main>
      </div>
    );
  }

  return (
    <div>
      <SiteNav />

      <PageTitle banner title="ชำระเงิน" />

      <main className="max-w-3xl mx-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-1.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-stone-800">สรุปรายการสั่งซื้อ</h2>
          <Link href="/merch/cart" className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 transition-colors text-white rounded-lg px-4 py-2 text-sm font-semibold shadow-sm">✎ แก้ไขตะกร้า</Link>
        </div>
        {cart.map((line, i) => (
          <div key={i} className="flex justify-between gap-2 text-sm text-stone-700">
            <span>
              {line.name}
              {line.size && <span className="text-stone-400"> · ไซส์ {line.size}</span>}
              <span className="text-stone-400"> × {line.quantity}</span>
            </span>
            <span>{(line.unitPrice * line.quantity).toLocaleString()} บาท</span>
          </div>
        ))}
        <div className="flex justify-between text-sm text-stone-600 pt-1 border-t border-cream-200">
          <span>ค่าจัดส่ง</span>
          <span>{shippingFee.toLocaleString()} บาท</span>
        </div>
        <div className="flex justify-between font-semibold text-stone-800">
          <span>รวมทั้งหมด ({cartCount} ชิ้น)</span>
          <span>{total.toLocaleString()} บาท</span>
        </div>
      </div>

      <form id="checkout-form" onSubmit={checkout} noValidate className="max-w-3xl mx-auto w-full bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-3">
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

        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ระบบจะกันสินค้าไว้ให้ท่าน {PENDING_HOLD_MINUTES} นาที หลังกดยืนยัน ท่านจะไปหน้าชำระเงิน (สแกน QR และแนบสลิป) หากไม่ชำระภายในเวลาดังกล่าว คำสั่งซื้อจะถูกยกเลิกและสินค้าจะกลับเข้าหน้าร้าน
        </p>

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

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <Link
            href="/merch/cart"
            className="flex-1 text-center bg-orange-500 hover:bg-orange-600 transition-colors text-white rounded-lg py-2.5 font-semibold"
          >
            ← กลับไปตะกร้าสินค้า
          </Link>
          <button
            type="submit"
            disabled={submitting || cart.length === 0}
            className="flex-1 bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg py-2.5 font-semibold disabled:opacity-50"
          >
            {submitting ? "กำลังส่งข้อมูล..." : "ยืนยันคำสั่งซื้อและไปหน้าชำระเงิน"}
          </button>
        </div>
      </form>
      </main>
    </div>
  );
}
