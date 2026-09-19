"use client";

import { useEffect, useState } from "react";
import SizeChart from "../components/size-chart";

export interface ShopProduct {
  id: string;
  name: string;
  description: string | null;
  price: string;
  requiresSize: boolean;
  imageUrl: string | null;
  // Cover image first, then extra gallery photos (built server-side).
  images: string[];
  sizeGuideUrl: string | null;
  // "" -> qty for non-sized products; per-size key otherwise. A missing
  // key means 0 in stock, same as an explicit 0.
  stock: Record<string, number>;
}

export const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

// Products with this many units (or fewer) left in total get a "low stock"
// badge on the shop grid / detail view.
export const LOW_STOCK_THRESHOLD = 5;

export function totalStock(p: ShopProduct): number {
  const sizes = p.requiresSize ? SIZES : [""];
  return sizes.reduce((sum, s) => sum + (p.stock?.[s] ?? 0), 0);
}

export function StockBadge({ product }: { product: ShopProduct }) {
  const total = totalStock(product);
  if (total <= 0) {
    return <span className="text-xs font-medium bg-red-100 text-red-700 rounded-full px-2 py-0.5">สินค้าหมด</span>;
  }
  if (total <= LOW_STOCK_THRESHOLD) {
    return <span className="text-xs font-medium bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">เหลือน้อย ({total})</span>;
  }
  return null;
}

export function SizeChips({
  value,
  onChange,
  remainingFor,
}: {
  value: string;
  onChange: (size: string) => void;
  remainingFor: (size: string) => number;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="เลือกไซส์">
      {SIZES.map((s) => {
        const out = remainingFor(s) <= 0;
        const selected = value === s;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={out}
            onClick={() => onChange(s)}
            className={`min-w-[3rem] px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              selected
                ? "bg-maroon-700 border-maroon-700 text-white"
                : out
                  ? "bg-stone-50 border-stone-200 text-stone-300 line-through cursor-not-allowed"
                  : "bg-white border-stone-300 text-stone-700 hover:border-maroon-700"
            }`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

export function QtyStepper({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  const clamp = (n: number) => Math.max(1, Math.min(Number.isFinite(n) ? Math.floor(n) : 1, Math.max(1, max)));
  const btn =
    "w-10 h-10 flex items-center justify-center text-lg text-stone-700 hover:bg-cream-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors";
  return (
    <div className="inline-flex items-center border border-stone-300 rounded-lg overflow-hidden">
      <button type="button" aria-label="ลดจำนวน" onClick={() => onChange(clamp(value - 1))} disabled={value <= 1} className={btn}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={Math.max(1, max)}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        aria-label="จำนวน"
        className="w-12 h-10 text-center text-sm border-x border-stone-300 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" aria-label="เพิ่มจำนวน" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} className={btn}>
        +
      </button>
    </div>
  );
}

// Size chips + quantity stepper + add-to-cart button. Shared by the grid
// card and the detail modal so both stay in sync.
export function PurchaseControls({
  product,
  size,
  quantity,
  remainingFor,
  onSize,
  onQty,
  onAdd,
}: {
  product: ShopProduct;
  size: string;
  quantity: number;
  remainingFor: (size: string) => number;
  onSize: (size: string) => void;
  onQty: (n: number) => void;
  onAdd: () => void;
}) {
  const key = product.requiresSize ? size : "";
  const stockNow = product.stock?.[key] ?? 0;
  const remaining = remainingFor(key);
  const anyStock = totalStock(product) > 0;

  if (!anyStock) return <p className="text-sm font-medium text-red-600">สินค้าหมด</p>;

  return (
    <div className="flex flex-col gap-3">
      {product.requiresSize && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-stone-700">ไซส์</span>
            {stockNow > 0 && <span className="text-xs text-stone-400">เหลือ {stockNow} ชิ้น</span>}
          </div>
          <SizeChips value={size} onChange={onSize} remainingFor={remainingFor} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-700">
            จำนวน{!product.requiresSize && <span className="text-xs text-stone-400 font-normal"> (เหลือ {stockNow})</span>}
          </span>
          <QtyStepper value={Math.min(quantity, Math.max(1, remaining))} max={remaining} onChange={onQty} />
        </div>
      </div>

      <button
        type="button"
        onClick={onAdd}
        disabled={remaining <= 0}
        className="bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg py-2.5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {remaining > 0 ? "+ เพิ่มลงตะกร้า" : stockNow > 0 ? "ในตะกร้าครบตามจำนวนที่เหลือแล้ว" : "หมด"}
      </button>
    </div>
  );
}

export function ProductModal({
  product,
  size,
  quantity,
  remainingFor,
  onSize,
  onQty,
  onAdd,
  onClose,
  onZoom,
  escapeDisabled,
}: {
  product: ShopProduct;
  size: string;
  quantity: number;
  remainingFor: (size: string) => number;
  onSize: (size: string) => void;
  onQty: (n: number) => void;
  onAdd: () => void;
  onClose: () => void;
  onZoom: (url: string, alt: string) => void;
  // True while the full-screen image lightbox is open on top, so Escape
  // closes only that layer instead of both.
  escapeDisabled: boolean;
}) {
  const [index, setIndex] = useState(0);
  const images = product.images.length > 0 ? product.images : product.imageUrl ? [product.imageUrl] : [];
  const current = images[Math.min(index, Math.max(0, images.length - 1))];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (escapeDisabled) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => (images.length ? (i + 1) % images.length : 0));
      if (e.key === "ArrowLeft") setIndex((i) => (images.length ? (i - 1 + images.length) % images.length : 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [escapeDisabled, images.length, onClose]);

  // Lock background scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const arrow =
    "absolute top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-stone-700 rounded-full w-9 h-9 flex items-center justify-center shadow";

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="sticky top-2 float-right mr-2 mt-2 z-10 bg-white/90 hover:bg-white border border-stone-200 rounded-full w-9 h-9 flex items-center justify-center text-xl text-stone-600"
        >
          ×
        </button>

        <div className="grid sm:grid-cols-2 gap-5 p-4 sm:p-6">
          <div className="flex flex-col gap-2">
            <div className="relative">
              {current ? (
                <button
                  type="button"
                  onClick={() => onZoom(current, product.name)}
                  className="block w-full cursor-zoom-in"
                  aria-label="ดูภาพขยาย"
                >
                  <img src={current} alt={product.name} className="w-full aspect-square object-cover rounded-xl bg-cream-100" />
                </button>
              ) : (
                <div className="w-full aspect-square bg-cream-100 rounded-xl flex items-center justify-center text-stone-400 text-sm">
                  ไม่มีรูปภาพ
                </div>
              )}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="รูปก่อนหน้า"
                    onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
                    className={`${arrow} left-2`}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="รูปถัดไป"
                    onClick={() => setIndex((i) => (i + 1) % images.length)}
                    className={`${arrow} right-2`}
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`รูปที่ ${i + 1}`}
                    className={`shrink-0 rounded-lg overflow-hidden border-2 ${i === index ? "border-maroon-700" : "border-transparent opacity-70 hover:opacity-100"}`}
                  >
                    <img src={url} alt="" className="w-16 h-16 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <h2 className="font-display font-semibold text-xl text-stone-800 pr-10">{product.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold text-maroon-700">{Number(product.price).toLocaleString()} บาท</span>
                <StockBadge product={product} />
              </div>
            </div>
            {product.description && <p className="text-sm text-stone-600 whitespace-pre-line">{product.description}</p>}

            <PurchaseControls
              product={product}
              size={size}
              quantity={quantity}
              remainingFor={remainingFor}
              onSize={onSize}
              onQty={onQty}
              onAdd={onAdd}
            />
          </div>
        </div>

        {/* Size chart spans the full width of the panel (below both columns). */}
        {product.requiresSize && (
          <div className="px-4 sm:px-6 pb-5 sm:pb-6">
            {!product.sizeGuideUrl ? (
              // No custom chart uploaded by admin -> built-in shirt size table.
              <SizeChart />
            ) : (
              <div className="rounded-xl border border-cream-200 bg-cream-50 p-3 sm:p-4">
                <div className="text-sm font-display font-semibold text-stone-800 mb-2">ตารางขนาด</div>
                <button
                  type="button"
                  onClick={() => onZoom(product.sizeGuideUrl!, `ตารางขนาด ${product.name}`)}
                  className="block w-full cursor-zoom-in"
                  aria-label="ดูตารางขนาดขยาย"
                >
                  <img src={product.sizeGuideUrl} alt={`ตารางขนาด ${product.name}`} className="w-full rounded-lg border border-cream-200" />
                </button>
                <p className="text-xs text-stone-400 mt-1">แตะที่รูปเพื่อขยาย</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
