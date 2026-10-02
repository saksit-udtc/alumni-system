"use client";
// ไอคอนตะกร้าลอยมุมขวาบน (อยู่เหนือหน้าต่างรายละเอียดสินค้าด้วย) — เอาเมาส์ไปชี้ (หรือโฟกัสด้วยคีย์บอร์ด) เพื่อดูว่าเลือกอะไรไปแล้วบ้าง
import Link from "next/link";
import { useMerchCart } from "@/lib/merch-cart";

export function FloatingCart({ widthClass = "max-w-5xl" }: { widthClass?: string }) {
  const { cart, ready } = useMerchCart();
  const count = cart.reduce((s, l) => s + l.quantity, 0);
  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  return (
    // ลอยค้างที่ขอบขวาของ "คอลัมน์เนื้อหา" (ไม่ใช่ขอบจอ) เพื่อให้อยู่ใกล้สินค้าบนจอกว้าง
    <div className="fixed top-16 inset-x-0 z-[70] pointer-events-none">
      <div className={`mx-auto px-4 flex justify-end ${widthClass}`}>
    <div className="group relative pointer-events-auto">
      {/* กระบอกรายละเอียด */}
      <div className="hidden group-hover:block group-focus-within:block absolute top-full right-0 mt-3 w-72 max-w-[85vw] rounded-xl bg-white border border-cream-200 shadow-xl p-3 text-sm">
        <p className="font-display font-semibold text-stone-800 mb-2">ตะกร้าสินค้า</p>
        {!ready || cart.length === 0 ? (
          <p className="text-stone-400 text-xs">ยังไม่มีสินค้าในตะกร้า</p>
        ) : (
          <>
            <ul className="space-y-1.5 max-h-60 overflow-auto">
              {cart.map((l, i) => (
                <li key={i} className="flex justify-between gap-2 text-xs text-stone-700">
                  <span className="min-w-0">
                    {l.name}
                    {l.size ? <span className="text-stone-400"> · ไซส์ {l.size}</span> : null}
                    <span className="text-stone-400"> × {l.quantity}</span>
                  </span>
                  <span className="shrink-0">{(l.unitPrice * l.quantity).toLocaleString()}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 pt-2 border-t border-cream-200 flex justify-between text-xs font-semibold text-stone-800">
              <span>ยอดสินค้า ({count} ชิ้น)</span>
              <span>{subtotal.toLocaleString()} บาท</span>
            </div>
            <p className="mt-1 text-[11px] text-stone-400">คลิกไอคอนเพื่อไปหน้าตะกร้า</p>
          </>
        )}
      </div>

      <Link
        href="/merch/cart"
        aria-label={`ตะกร้าสินค้า ${count} ชิ้น`}
        className="relative flex items-center justify-center w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 active:scale-95 transition text-white shadow-lg"
      >
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        {ready && count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center border-2 border-white">
            {count}
          </span>
        )}
      </Link>
    </div>
      </div>
    </div>
  );
}
