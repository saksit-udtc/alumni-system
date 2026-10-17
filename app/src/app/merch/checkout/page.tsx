"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteNav from "../../components/site-nav";
import PageTitle from "@/app/components/page-title";
import AddressFields from "@/app/components/address-fields";
import { EMPTY_ADDRESS, validateThaiAddress, composeThaiAddress, normalizeThaiAddress, type ThaiAddress } from "@/lib/thaiAddress";
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
  const [addr, setAddr] = useState<ThaiAddress>(EMPTY_ADDRESS);
  const [consent, setConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // เมื่อกดส่งครั้งแรกแล้ว จะตรวจซ้ำแบบสดทุกครั้งที่แก้ข้อมูล เพื่อให้ข้อความแดงหายทันทีเมื่อกรอกถูก
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [orderCode, setOrderCode] = useState("");
  const [baseShippingFee, setShippingFee] = useState(0);
  const [pickupEnabled, setPickupEnabled] = useState(false);
  const [pickup, setPickup] = useState(false);
  const usePickup = pickupEnabled && pickup;
  const shippingFee = usePickup ? 0 : baseShippingFee;
  // Same PromptPay setting the POS payment screen and table-booking form use

  useEffect(() => {
    fetch("/api/merch/products")
      .then((r) => r.json())
      .then((d) => {
        setShippingFee(Number(d.shippingFee) || 0);
        setPickupEnabled(!!d.pickupEnabled);
      })
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

    if (!usePickup) Object.assign(errs, validateThaiAddress(addr));
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
  }, [submitted, bookerFirstName, bookerLastName, bookerPhone, bookerEmail, addr, consent, usePickup]);

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
      formData.append("shippingAddress", usePickup ? "" : composeThaiAddress(normalizeThaiAddress(addr)));
      if (!usePickup) {
        const a = normalizeThaiAddress(addr);
        formData.append("addrLine", a.line);
        formData.append("addrSubdistrict", a.subdistrict);
        formData.append("addrDistrict", a.district);
        formData.append("addrProvince", a.province);
        formData.append("addrPostcode", a.postcode);
        if (a.manual) formData.append("addrManual", "1");
      }
      if (usePickup) formData.append("pickup", "1");
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

        {pickupEnabled && (
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-stone-700">วิธีรับสินค้า <span className="text-red-600">*</span></span>
            <div role="group" aria-label="วิธีรับสินค้า" className="relative grid grid-cols-2 p-1.5 rounded-full bg-slate-100">
              <span aria-hidden="true" className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.375rem)] rounded-full bg-white shadow-md transition-transform duration-300 ease-out ${usePickup ? "translate-x-0" : "translate-x-full"}`} />
              <button type="button" aria-pressed={usePickup} onClick={() => setPickup(true)}
                className={`relative z-10 flex items-center justify-center gap-2 rounded-full px-3 py-3 transition-colors duration-300 ${usePickup ? "text-maroon-700 font-semibold" : "text-stone-500 hover:text-stone-700"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/></svg>
                <span>รับที่วิทยาลัย</span>
              </button>
              <button type="button" aria-pressed={!usePickup} onClick={() => setPickup(false)}
                className={`relative z-10 flex items-center justify-center gap-2 rounded-full px-3 py-3 transition-colors duration-300 ${!usePickup ? "text-maroon-700 font-semibold" : "text-stone-500 hover:text-stone-700"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
                <span>จัดส่งทางไปรษณีย์ (+{baseShippingFee.toLocaleString()} บาท)</span>
              </button>
            </div>
          </div>
        )}
        {!usePickup && <AddressFields value={addr} onChange={setAddr} errors={fieldErrors} />}

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
