"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteNav from "../components/site-nav";
import PageTitle from "@/app/components/page-title";
import { FloatingCart } from "./cart-widgets";
import { useMerchCart } from "@/lib/merch-cart";
import { ShopProduct, SIZES, StockBadge, ProductModal, totalStock } from "./shop-parts";
type Product = ShopProduct;

export default function MerchShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<Record<string, { size: string; quantity: number }>>({});
  const { cart, addLine } = useMerchCart();

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
      })
      .finally(() => setLoading(false));
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
    addLine({ productId: p.id, name: p.name, size, quantity, unitPrice: Number(p.price) });
    updateSelection(p.id, { quantity: 1 });
    setToast(`เพิ่ม ${p.name}${size ? ` (${size})` : ""} ×${quantity} ลงตะกร้าแล้ว`);
  }

  function remainingForSize(p: Product, size: string) {
    return stockFor(p, size) - inCartQty(p.id, p.requiresSize ? size : undefined);
  }

  const detailProduct = detailId ? products.find((p) => p.id === detailId) ?? null : null;
  return (
    <div>
      <SiteNav />

      <PageTitle banner title="สั่งซื้อของที่ระลึก" />

      <main className="max-w-5xl mx-auto p-4 space-y-6 pb-24">
      {loading && <p className="text-stone-500">กำลังโหลด...</p>}
      {!loading && products.length === 0 && merchPackages.length === 0 && <p className="text-stone-500">ยังไม่มีสินค้าเปิดขายในขณะนี้</p>}

      {/* มือถือ 2×2, จอใหญ่ 4 คอลัมน์ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {products.map((p) => {
          const soldOut = totalStock(p) <= 0;
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
                <div className="mt-auto pt-2">
                  <button
                    type="button"
                    onClick={() => setDetailId(p.id)}
                    className="w-full border border-stone-300 hover:border-maroon-700 hover:text-maroon-700 transition-colors text-stone-600 rounded-lg py-2 text-sm font-medium"
                  >
                    รายละเอียด
                  </button>
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

      {toast && (
        <div
          role="status"
          className={`fixed left-1/2 -translate-x-1/2 z-[60] bg-stone-800 text-white text-sm rounded-full px-4 py-2 shadow-lg max-w-[90vw] text-center bottom-24`}
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
      <FloatingCart />
    </div>
  );
}
