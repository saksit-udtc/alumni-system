"use client";
import AddressFields from "@/app/components/address-fields";
import { EMPTY_ADDRESS, validateThaiAddress, composeThaiAddress, normalizeThaiAddress, type ThaiAddress } from "@/lib/thaiAddress";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import SiteNav from "@/app/components/site-nav";
import PageTitle from "@/app/components/page-title";
import { PENDING_HOLD_MINUTES } from "@/lib/holdPolicy";

// เรียงไซส์เสื้อจากเล็กไปใหญ่ (API คืนตามลำดับแถวสต๊อก ซึ่งอาจเป็น L ก่อน S) — ไซส์ที่ไม่รู้จักต่อท้าย
const SIZE_ORDER = ["SS", "S", "M", "L", "XL", "3L", "4L", "6L", "8L"];
function sortSizes(sizes: string[]): string[] {
  const rank = (s: string) => {
    const i = SIZE_ORDER.indexOf(s.trim().toUpperCase());
    return i === -1 ? SIZE_ORDER.length : i;
  };
  return [...sizes].sort((a, b) => rank(a) - rank(b));
}
import {
  validateNamePart,
  validateThaiPhone,
  formatThaiPhoneDisplay,
  cleanPhoneForStorage,
  isValidEmailFormat,
  normalizeEmail,
} from "@/lib/formValidation";

// ขนาดไฟล์สลิปสูงสุดฝั่งหน้าเว็บ (ตรงกับเพดาน 10MB ของ upload อื่นๆ ในระบบ)

interface PackageItem {
  packageItemId: string;
  productName: string;
  productImageUrl: string | null;
  size: string | null;
  quantity: number;
  buyerChoosesSize: boolean;
  availableSizes: string[];
}

interface MerchPackage {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  items: PackageItem[];
}

// ลำดับช่องบนฟอร์ม — ใช้เลื่อนหน้าจอไปช่องแรกที่ผิดตอนกดส่ง (เติม itemSize-* ต่อท้ายตอนรัน)
const BASE_FIELD_ORDER = ["bookerFirstName", "bookerLastName", "bookerPhone", "bookerEmail", "addrLine", "addrSubdistrict", "addrDistrict", "addrProvince", "addrPostcode", "consent"];

export default function MerchPackageOrderPage() {
  const params = useParams();
  const router = useRouter();
  const packageId = String(params.id);

  const [pkg, setPkg] = useState<MerchPackage | null>(null);
  const [baseShippingFee, setShippingFee] = useState(0);
  const [pickupEnabled, setPickupEnabled] = useState(false);
  const [pickup, setPickup] = useState(false);
  const usePickup = pickupEnabled && pickup;
  const shippingFee = usePickup ? 0 : baseShippingFee;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Full-screen image viewer for the package cover photo / included-item
  // thumbnails — same pattern as the lightbox on /merch's product grid.
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  useEffect(() => {
    fetch("/api/merch/packages")
      .then((r) => r.json())
      .then((d) => {
        const found = (d.packages || []).find((p: MerchPackage) => p.id === packageId);
        if (!found) {
          setLoadError("ไม่พบแพ็กเกจนี้ หรือแพ็กเกจถูกปิดการขายแล้ว");
        } else {
          setPkg(found);
          setShippingFee(d.shippingFee || 0);
          setPickupEnabled(!!d.pickupEnabled);
        }
      })
      .catch(() => setLoadError("ไม่สามารถโหลดข้อมูลแพ็กเกจได้ กรุณาลองใหม่"))
      .finally(() => setLoading(false));
  }, [packageId]);

  const [bookerFirstName, setBookerFirstName] = useState("");
  const [bookerLastName, setBookerLastName] = useState("");
  const [bookerPhone, setBookerPhone] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [addr, setAddr] = useState<ThaiAddress>(EMPTY_ADDRESS);
  const [itemSizeSelections, setItemSizeSelections] = useState<Record<string, string>>({});

  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  function touch(field: string) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [orderCode, setOrderCode] = useState("");

  const total = (pkg ? Number(pkg.price) : 0) + shippingFee;

  const sizedItems = useMemo(() => (pkg ? pkg.items.filter((it) => it.buyerChoosesSize) : []), [pkg]);

  const fieldOrder = useMemo(
    () => [...BASE_FIELD_ORDER.slice(0, 9), ...sizedItems.map((it) => `itemSize-${it.packageItemId}`), ...BASE_FIELD_ORDER.slice(9)],
    [sizedItems]
  );

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

    for (const it of sizedItems) {
      if (!itemSizeSelections[it.packageItemId]) {
        errs[`itemSize-${it.packageItemId}`] = `กรุณาเลือกไซส์สำหรับ "${it.productName}"`;
      }
    }

    if (!consent) {
      errs.consent = "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนยืนยันการสั่งซื้อ";
    }

    return errs;
  }

  const allErrors = computeErrors();
  const fieldErrors: Record<string, string> = {};
  for (const key of Object.keys(allErrors)) {
    if (submitted || touched[key]) fieldErrors[key] = allErrors[key];
  }

  function validate(): boolean {
    const errs = computeErrors();
    const first = fieldOrder.find((k) => errs[k]);
    if (first) {
      const el = document.getElementById(`mpkg-${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    }
    return !first;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitted(true);
    if (!validate()) return;

    setSubmitting(true);
    const bookerName = `${bookerFirstName.trim()} ${bookerLastName.trim()}`.trim();
    const cleanedPhone = cleanPhoneForStorage(bookerPhone);
    const cleanedEmail = normalizeEmail(bookerEmail);

    const formData = new FormData();
    formData.append("packageId", packageId);
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
    if (sizedItems.length > 0) formData.append("itemSizeSelections", JSON.stringify(itemSizeSelections));

    const res = await fetch("/api/merch/orders/package", { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) {
      setSubmitting(false);
      setError(data.error || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      return;
    }

    setSubmitting(false);
    setOrderCode(data.orderCode);
    setBookerPhone(cleanedPhone);
    setDone(true);
    router.push(`/merch/orders/${data.orderCode}/upload-slip?phone=${encodeURIComponent(cleanedPhone)}`);
  }

  const inputClass = (field: string) =>
    `w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-shadow ${
      fieldErrors[field]
        ? "border-red-400 focus:ring-red-300 focus:border-red-500"
        : "border-stone-300 focus:ring-primary-400 focus:border-primary-500"
    }`;

  return (
    <>
      <SiteNav />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <PageTitle title={pkg ? `สั่งซื้อแพ็กเกจ "${pkg.name}"` : "สั่งซื้อแพ็กเกจของที่ระลึก"} />

        {loading && <p className="text-stone-500 mt-4">กำลังโหลดข้อมูล...</p>}
        {!loading && loadError && (
          <div className="mt-4 bg-white border border-cream-200 shadow-md rounded-xl p-5 max-w-md">
            <p className="text-red-600">{loadError}</p>
            <Link href="/merch" className="inline-block mt-3 text-maroon-700 underline hover:text-maroon-800">
              กลับไปหน้าร้านของที่ระลึก
            </Link>
          </div>
        )}

        {!loading && pkg && !done && (
          <div className="mt-4 grid md:grid-cols-2 gap-6">
            <div className="bg-white border border-cream-200 shadow-md rounded-xl p-5 h-fit space-y-2">
              {pkg.imageUrl && (
                <img
                  src={pkg.imageUrl}
                  alt={pkg.name}
                  onClick={() => setLightbox({ url: pkg.imageUrl!, alt: pkg.name })}
                  className="w-full aspect-square object-cover rounded-lg cursor-zoom-in"
                />
              )}
              <h2 className="font-display font-semibold text-lg text-stone-800">{pkg.name}</h2>
              {pkg.description && <p className="text-sm text-stone-600">{pkg.description}</p>}
              <ul className="text-sm text-stone-600 space-y-2">
                {pkg.items.map((it) => (
                  <li key={it.packageItemId} className="flex items-center gap-2">
                    {it.productImageUrl ? (
                      <img
                        src={it.productImageUrl}
                        alt={it.productName}
                        onClick={() => setLightbox({ url: it.productImageUrl!, alt: it.productName })}
                        className="w-12 h-12 object-cover rounded-lg border border-cream-200 shrink-0 cursor-zoom-in"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-cream-100 flex items-center justify-center text-stone-400 text-[10px] shrink-0">ไม่มีรูป</div>
                    )}
                    <span>
                      {it.productName}
                      {it.size ? ` (ไซส์ ${it.size})` : it.buyerChoosesSize ? " (เลือกไซส์เอง)" : ""} × {it.quantity}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-cream-200 pt-2 text-sm text-stone-700 space-y-1">
                <div className="flex justify-between">
                  <span>ราคาแพ็กเกจ</span>
                  <span>{Number(pkg.price).toLocaleString()} บาท</span>
                </div>
                <div className="flex justify-between">
                  <span>ค่าจัดส่ง</span>
                  <span>{shippingFee.toLocaleString()} บาท</span>
                </div>
                <div className="flex justify-between font-semibold text-stone-800 border-t border-cream-200 pt-1">
                  <span>ยอดรวม</span>
                  <span>{total.toLocaleString()} บาท</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4 bg-white border border-cream-200 shadow-md rounded-xl p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    ชื่อผู้สั่งซื้อ <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="mpkg-bookerFirstName"
                    value={bookerFirstName}
                    onChange={(e) => setBookerFirstName(e.target.value)}
                    onBlur={() => touch("bookerFirstName")}
                    aria-invalid={!!fieldErrors.bookerFirstName}
                    autoComplete="given-name"
                    maxLength={100}
                    className={inputClass("bookerFirstName")}
                  />
                  {fieldErrors.bookerFirstName && <p className="text-xs text-red-600 mt-1">{fieldErrors.bookerFirstName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    นามสกุลผู้สั่งซื้อ <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="mpkg-bookerLastName"
                    value={bookerLastName}
                    onChange={(e) => setBookerLastName(e.target.value)}
                    onBlur={() => touch("bookerLastName")}
                    aria-invalid={!!fieldErrors.bookerLastName}
                    autoComplete="family-name"
                    maxLength={100}
                    className={inputClass("bookerLastName")}
                  />
                  {fieldErrors.bookerLastName && <p className="text-xs text-red-600 mt-1">{fieldErrors.bookerLastName}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  เบอร์โทรศัพท์ <span className="text-red-600">*</span>
                </label>
                <input
                  id="mpkg-bookerPhone"
                  type="tel"
                  inputMode="numeric"
                  onBlur={() => touch("bookerPhone")}
                  aria-invalid={!!fieldErrors.bookerPhone}
                  autoComplete="tel"
                  value={bookerPhone}
                  onChange={(e) => setBookerPhone(formatThaiPhoneDisplay(e.target.value))}
                  placeholder="08X-XXX-XXXX"
                  className={inputClass("bookerPhone")}
                />
                {fieldErrors.bookerPhone && <p className="text-xs text-red-600 mt-1">{fieldErrors.bookerPhone}</p>}
                <p className="text-xs text-stone-400 mt-1">ใช้เบอร์นี้เช็คสถานะการสั่งซื้อในภายหลัง</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  อีเมล <span className="text-red-600">*</span>
                </label>
                <input
                  id="mpkg-bookerEmail"
                  type="email"
                  aria-invalid={!!fieldErrors.bookerEmail}
                  autoComplete="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  value={bookerEmail}
                  onChange={(e) => setBookerEmail(e.target.value)}
                  onBlur={(e) => {
                    setBookerEmail(normalizeEmail(e.target.value));
                    touch("bookerEmail");
                  }}
                  className={inputClass("bookerEmail")}
                />
                {fieldErrors.bookerEmail && <p className="text-xs text-red-600 mt-1">{fieldErrors.bookerEmail}</p>}
                <p className="text-xs text-stone-400 mt-1">ใช้แจ้งสถานะคำสั่งซื้อ (หากไม่พบอีเมลในกล่องจดหมายเข้า กรุณาตรวจสอบในโฟลเดอร์อีเมลขยะ (Junk/Spam))</p>
              </div>


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
              {!usePickup && <AddressFields value={addr} onChange={setAddr} errors={fieldErrors} idPrefix="mpkg-" onTouch={touch} />}

              {sizedItems.length > 0 && (
                <div className="border-t border-cream-200 pt-3 space-y-3">
                  {sizedItems.map((it) => (
                    <div key={it.packageItemId}>
                      <label className="block text-sm font-medium text-stone-700 mb-1">
                        เลือกไซส์: {it.productName} <span className="text-red-600">*</span>
                      </label>
                      <select
                        id={`mpkg-itemSize-${it.packageItemId}`}
                        value={itemSizeSelections[it.packageItemId] || ""}
                        onChange={(e) => {
                          setItemSizeSelections((prev) => ({ ...prev, [it.packageItemId]: e.target.value }));
                          touch(`itemSize-${it.packageItemId}`);
                        }}
                        onBlur={() => touch(`itemSize-${it.packageItemId}`)}
                        aria-invalid={!!fieldErrors[`itemSize-${it.packageItemId}`]}
                        className={inputClass(`itemSize-${it.packageItemId}`)}
                      >
                        <option value="">-- เลือกไซส์ --</option>
                        {sortSizes(it.availableSizes).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      {fieldErrors[`itemSize-${it.packageItemId}`] && (
                        <p className="text-xs text-red-600 mt-1">{fieldErrors[`itemSize-${it.packageItemId}`]}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="text-sm font-medium text-stone-800">ยอดชำระ: {total.toLocaleString()} บาท</div>

              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ระบบจะกันสินค้าไว้ให้ท่าน {PENDING_HOLD_MINUTES} นาที หลังกดยืนยันท่านจะไปหน้าชำระเงิน (สแกน QR และแนบสลิป) หากไม่ชำระภายในเวลาดังกล่าว คำสั่งซื้อจะถูกยกเลิกและสินค้าจะกลับเข้าหน้าร้าน
              </p>

              <div className="border-t border-cream-200 pt-3">
                <label className="flex items-start gap-2 text-sm text-stone-700">
                  <input
                    id="mpkg-consent"
                    type="checkbox"
                    checked={consent}
                    aria-invalid={!!fieldErrors.consent}
                    onChange={(e) => {
                      setConsent(e.target.checked);
                      touch("consent");
                    }}
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
                disabled={submitting}
                className="w-full rounded bg-maroon-700 hover:bg-maroon-800 text-white font-medium py-2.5 transition-colors disabled:opacity-50"
              >
                {submitting ? "กำลังส่งข้อมูล..." : "ยืนยันการสั่งซื้อและไปหน้าชำระเงิน"}
              </button>
            </form>
          </div>
        )}

        {!loading && pkg && done && (
          <div className="mt-4 max-w-md p-6 text-center text-stone-600">กำลังไปหน้าชำระเงิน...</div>
        )}
      </main>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[58] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out overflow-auto"
        >
          <img
            src={lightbox.url}
            alt={lightbox.alt}
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
    </>
  );
}
