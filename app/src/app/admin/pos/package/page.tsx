"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QrCode from "@/app/components/qr-code";
import { generatePromptPayPayload } from "@/lib/promptpay";

interface PackageOption {
  id: string;
  name: string;
  description: string | null;
  // null = merch-only package (no table at all) — sold online only, never
  // listed here. See /admin/packages and lib/createMerchPackageOrder.ts.
  bookingType: "full_table" | "seats" | null;
  seatCount: number | null;
  price: string;
  active: boolean;
  event: { id: string; name: string; status: string };
  items: {
    id: string;
    productId: string;
    size: string | null;
    quantity: number;
    buyerChoosesSize: boolean;
    product: { name: string };
  }[];
}

interface TableOption {
  id: string;
  tableNumber: number;
  capacity: number;
  seatsReserved: number;
  isFullTableBooking: boolean;
  zone: string | null;
}

interface ProductOption {
  id: string;
  name: string;
  stocks: { id: string; size: string | null; quantity: number }[];
}

// POS counter flow for selling a pre-configured Package: pick the package
// (which fixes the event, booking type, seat count and bundled items) →
// pick an available table for that event → take buyer info + payment →
// confirm. Mirrors ../page.tsx's payment panel (PromptPay QR reuse) but
// there's no barcode-scan cart here since the package's contents are fixed.
// Only table+merch packages (bookingType full_table/seats) are ever listed
// here — a merch-only package (bookingType null) is sold online only
// through the merch shop, never at this POS counter.
export default function PosPackageSalePage() {
  const router = useRouter();
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [packageId, setPackageId] = useState("");
  const [tables, setTables] = useState<TableOption[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tableId, setTableId] = useState("");
  const [itemSizeSelections, setItemSizeSelections] = useState<Record<string, string>>({});
  const [bookerName, setBookerName] = useState("");
  const [bookerPhone, setBookerPhone] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [promptPayId, setPromptPayId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/packages")
      .then((r) => r.json())
      .then((d) =>
        setPackages(
          (d.packages || []).filter((p: PackageOption) => p.active && p.bookingType !== null && p.event.status === "open")
        )
      )
      .finally(() => setLoadingPackages(false));
    fetch("/api/admin/packages/products-options")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []));
  }, []);

  useEffect(() => {
    fetch("/api/admin/pos/settings")
      .then((r) => r.json())
      .then((d) => setPromptPayId(d.promptPayId || ""));
  }, []);

  const selectedPackage = packages.find((p) => p.id === packageId) || null;

  useEffect(() => {
    setTableId("");
    setTables([]);
    setItemSizeSelections({});
    if (!selectedPackage) return;
    setLoadingTables(true);
    fetch(
      `/api/admin/packages/tables?eventId=${selectedPackage.event.id}&bookingType=${selectedPackage.bookingType}&seatCount=${selectedPackage.seatCount}`
    )
      .then((r) => r.json())
      .then((d) => setTables(d.tables || []))
      .finally(() => setLoadingTables(false));
  }, [packageId]);

  function sizesForProduct(productId: string): string[] {
    const product = products.find((p) => p.id === productId);
    if (!product) return [];
    return product.stocks.filter((s) => s.quantity > 0).map((s) => s.size || "");
  }

  const promptPayPayload = useMemo(() => {
    if (paymentMethod !== "transfer" || !promptPayId || !selectedPackage) return null;
    try {
      return generatePromptPayPayload(promptPayId, Number(selectedPackage.price));
    } catch {
      return null;
    }
  }, [paymentMethod, promptPayId, selectedPackage]);

  async function submitSale() {
    setError("");
    if (!packageId) return setError("กรุณาเลือกแพ็กเกจ");
    if (!tableId) return setError("กรุณาเลือกโต๊ะ");
    if (!bookerName.trim() || !bookerPhone.trim()) {
      return setError("กรุณากรอกชื่อและเบอร์โทรศัพท์ผู้จอง");
    }
    for (const it of selectedPackage?.items || []) {
      if (it.buyerChoosesSize && !itemSizeSelections[it.id]) {
        return setError(`กรุณาเลือกไซส์สำหรับ "${it.product.name}"`);
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/packages/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          tableId,
          bookerName: bookerName.trim() || undefined,
          bookerPhone: bookerPhone.trim() || undefined,
          bookerEmail: bookerEmail.trim() || undefined,
          paymentMethod,
          itemSizeSelections,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "บันทึกการขายไม่สำเร็จ");
        return;
      }
      router.push(`/admin/pos/package/receipt/${data.reservation.id}`);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">ขายแพ็กเกจหน้างาน</h1>
          <p className="text-sm text-stone-500 mt-0.5">เลือกแพ็กเกจ เลือกโต๊ะ รับชำระเงิน แล้วพิมพ์ใบยืนยัน</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/pos" className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors">
            ขายสินค้าปกติ (POS)
          </Link>
          <Link href="/admin/packages" className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors">
            จัดการแพ็กเกจ
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">แพ็กเกจ</span>
              {loadingPackages ? (
                <div className="text-sm text-stone-400">กำลังโหลด...</div>
              ) : packages.length === 0 ? (
                <div className="text-sm text-stone-400">ยังไม่มีแพ็กเกจที่เปิดขาย — ตั้งค่าได้ที่หน้าจัดการแพ็กเกจ</div>
              ) : (
                <select value={packageId} onChange={(e) => setPackageId(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2">
                  <option value="">-- เลือกแพ็กเกจ --</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.event.name} ({Number(p.price).toLocaleString()} บาท)
                    </option>
                  ))}
                </select>
              )}
            </label>

            {selectedPackage && (
              <div className="text-xs text-stone-500 border-t border-cream-100 pt-2 mt-1">
                {selectedPackage.bookingType === "full_table" ? "จองทั้งโต๊ะ" : `จอง ${selectedPackage.seatCount} ที่นั่ง`}{" "}
                · ของแถม:{" "}
                {selectedPackage.items.map((it, i) => (
                  <span key={it.id}>
                    {i > 0 && ", "}
                    {it.product.name}
                    {it.buyerChoosesSize ? " (เลือกไซส์เอง)" : it.size ? ` (${it.size})` : ""} x{it.quantity}
                  </span>
                ))}
              </div>
            )}

            {selectedPackage && selectedPackage.items.some((it) => it.buyerChoosesSize) && (
              <div className="border-t border-cream-100 pt-2 mt-1 space-y-2">
                <span className="text-xs font-medium text-stone-700 block">เลือกไซส์สำหรับลูกค้า</span>
                {selectedPackage.items
                  .filter((it) => it.buyerChoosesSize)
                  .map((it) => {
                    const sizes = sizesForProduct(it.productId);
                    return (
                      <label key={it.id} className="flex items-center gap-2 text-sm">
                        <span className="text-stone-600 min-w-0 flex-1 truncate">{it.product.name}</span>
                        <select
                          value={itemSizeSelections[it.id] || ""}
                          onChange={(e) => setItemSizeSelections((prev) => ({ ...prev, [it.id]: e.target.value }))}
                          className="border border-stone-300 rounded-lg px-2 py-1.5 text-sm"
                        >
                          <option value="">-- ไซส์ --</option>
                          {sizes.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
              </div>
            )}
          </div>

          {selectedPackage && (
            <div className="bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-2">
              <span className="font-medium text-sm block">เลือกโต๊ะ</span>
              {loadingTables ? (
                <div className="text-sm text-stone-400">กำลังโหลด...</div>
              ) : tables.length === 0 ? (
                <div className="text-sm text-stone-400">ไม่มีโต๊ะว่างที่รองรับแพ็กเกจนี้ในงานนี้</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {tables.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTableId(t.id)}
                      className={`rounded-lg border py-2 text-sm font-medium transition-colors ${
                        tableId === t.id ? "bg-maroon-700 text-white border-maroon-700" : "bg-white text-stone-700 border-stone-300 hover:bg-cream-50"
                      }`}
                    >
                      โต๊ะ {t.tableNumber}
                      {t.zone && <div className="text-[10px] font-normal opacity-80">{t.zone}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-3 lg:sticky lg:top-4">
            <h2 className="font-display font-semibold text-stone-800">ข้อมูลผู้จอง + ชำระเงิน</h2>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">ชื่อผู้จอง *</span>
              <input value={bookerName} onChange={(e) => setBookerName(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">เบอร์โทร *</span>
              <input value={bookerPhone} onChange={(e) => setBookerPhone(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">อีเมล (ถ้ามี)</span>
              <input value={bookerEmail} onChange={(e) => setBookerEmail(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2" />
            </label>

            <div>
              <span className="text-sm font-medium block mb-1">วิธีชำระเงิน</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium border transition-colors ${
                    paymentMethod === "cash" ? "bg-maroon-700 text-white border-maroon-700" : "bg-white text-stone-700 border-stone-300 hover:bg-cream-50"
                  }`}
                >
                  เงินสด
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("transfer")}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium border transition-colors ${
                    paymentMethod === "transfer" ? "bg-maroon-700 text-white border-maroon-700" : "bg-white text-stone-700 border-stone-300 hover:bg-cream-50"
                  }`}
                >
                  โอนเงิน
                </button>
              </div>
            </div>

            {paymentMethod === "transfer" && (
              <div className="border border-cream-200 rounded-lg p-3 flex flex-col items-center text-center">
                {promptPayPayload ? (
                  <>
                    <QrCode value={promptPayPayload} size={180} />
                    <div className="text-xs text-stone-500 mt-2">
                      ให้ลูกค้าสแกนจ่ายยอด {Number(selectedPackage?.price ?? 0).toLocaleString()} บาท แล้วตรวจสอบว่าเงินเข้าก่อนกดยืนยันการขาย
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-stone-400">
                    {promptPayId ? "เลือกแพ็กเกจก่อนเพื่อสร้าง QR" : "ยังไม่ได้ตั้งค่าเลขพร้อมเพย์ — ตั้งค่าได้ที่หน้าจัดการสินค้า/สต๊อก"}
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-cream-200 pt-3 flex items-center justify-between">
              <span className="font-display font-semibold text-stone-800">ยอดรวม</span>
              <span className="text-2xl font-bold text-maroon-700">{Number(selectedPackage?.price ?? 0).toLocaleString()} บาท</span>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              onClick={submitSale}
              disabled={submitting || !selectedPackage || !tableId}
              className="w-full bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg py-3 font-semibold disabled:opacity-50"
            >
              {submitting ? "กำลังบันทึก..." : "ยืนยันการขาย + พิมพ์ใบยืนยัน"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
