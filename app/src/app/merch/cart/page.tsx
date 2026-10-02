"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteNav from "../../components/site-nav";
import PageTitle from "@/app/components/page-title";
import { FloatingCart } from "../cart-widgets";
import { useMerchCart } from "@/lib/merch-cart";
import type { ShopProduct } from "../shop-parts";

export default function MerchCartPage() {
  const { cart, ready, removeLine, setQuantity } = useMerchCart();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [shippingFee, setShippingFee] = useState(0);

  useEffect(() => {
    fetch("/api/merch/products")
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.products || []);
        setShippingFee(Number(d.shippingFee) || 0);
      })
      .catch(() => {});
  }, []);

  function maxFor(productId: string, size?: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return 99;
    return p.stock?.[size || ""] ?? 0;
  }

  const count = cart.reduce((s, l) => s + l.quantity, 0);
  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const total = cart.length > 0 ? subtotal + shippingFee : 0;
  const empty = ready && cart.length === 0;

  return (
    <div>
      <SiteNav />
      <PageTitle banner title="ตะกร้าสินค้า" />

      <main className="max-w-3xl mx-auto p-4 pb-24 md:pb-4 space-y-4">
        <div className="bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-2">
          {!ready && <p className="text-sm text-stone-400">กำลังโหลด...</p>}
          {empty && <p className="text-sm text-stone-400">ยังไม่มีสินค้าในตะกร้า</p>}

          <div className="flex flex-col gap-3">
            {cart.map((line, i) => {
              const max = maxFor(line.productId, line.size);
              return (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-cream-200 pb-3">
                  <div>
                    <span className="font-medium text-stone-800">{line.name}</span>
                    {line.size && <span className="text-stone-400"> · ไซส์ {line.size}</span>}
                    <div className="text-xs text-stone-400">{line.unitPrice.toLocaleString()} บาท / ชิ้น</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center border border-stone-300 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setQuantity(i, line.quantity - 1)}
                        disabled={line.quantity <= 1}
                        className="w-8 h-8 text-stone-600 hover:bg-cream-100 disabled:opacity-40"
                        aria-label="ลดจำนวน"
                      >
                        −
                      </button>
                      <span className="w-8 text-center">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(i, line.quantity + 1)}
                        disabled={line.quantity >= max}
                        className="w-8 h-8 text-stone-600 hover:bg-cream-100 disabled:opacity-40"
                        aria-label="เพิ่มจำนวน"
                      >
                        +
                      </button>
                    </div>
                    <span className="w-24 text-right text-stone-700">{(line.unitPrice * line.quantity).toLocaleString()} บาท</span>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      aria-label={`ลบ ${line.name} ออกจากตะกร้า`}
                      title="ลบออกจากตะกร้า"
                      className="flex items-center justify-center w-[33px] h-[33px] rounded-lg text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {cart.length > 0 && (
            <div className="pt-2 space-y-1">
              <div className="flex justify-between text-sm text-stone-600">
                <span>ยอดสินค้า ({count} ชิ้น)</span>
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

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <Link
            href="/merch"
            className="flex-1 text-center bg-orange-500 hover:bg-orange-600 transition-colors text-white rounded-lg py-2.5 font-semibold"
          >
            ← กลับไปเลือกซื้อสินค้า
          </Link>
          {cart.length > 0 ? (
            <Link
              href="/merch/checkout"
              className="flex-1 text-center bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg py-2.5 font-semibold"
            >
              ชำระเงิน →
            </Link>
          ) : (
            <span className="flex-1 text-center bg-maroon-700 text-white rounded-lg py-2.5 font-semibold opacity-50 cursor-not-allowed">
              ชำระเงิน →
            </span>
          )}
        </div>
      </main>

      <FloatingCart widthClass="max-w-3xl" />
    </div>
  );
}
