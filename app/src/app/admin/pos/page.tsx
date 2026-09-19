"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QrCode from "@/app/components/qr-code";
import SizeChart from "@/app/components/size-chart";
import { generatePromptPayPayload } from "@/lib/promptpay";

interface StockRow {
  id: string;
  size: string | null;
  quantity: number;
  barcode: string | null;
}
interface Product {
  id: string;
  name: string;
  price: string;
  requiresSize: boolean;
  stocks: StockRow[];
}
interface CartLine {
  barcode: string;
  stockId: string;
  productName: string;
  size: string | null;
  unitPrice: number;
  quantity: number;
  maxQuantity: number;
}

export default function PosTerminalPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState("");
  const [manualProductId, setManualProductId] = useState("");
  const [manualSize, setManualSize] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [promptPayId, setPromptPayId] = useState("");
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Modal เลือกไซส์/ปรับจำนวนก่อนเพิ่มลงตะกร้า
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [modalStockId, setModalStockId] = useState<string>("");
  const [modalQty, setModalQty] = useState(1);

  function loadProducts() {
    fetch("/api/admin/pos/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []));
  }
  useEffect(loadProducts, []);

  useEffect(() => {
    fetch("/api/admin/pos/settings")
      .then((r) => r.json())
      .then((d) => setPromptPayId(d.promptPayId || ""));
  }, []);

  // Keep the scan field focused so a USB/Bluetooth barcode scanner (which
  // just "types" the code fast and sends Enter) always lands here, even
  // after clicking elsewhere on the page — refocus on any click that
  // didn't land on another text input.
  useEffect(() => {
    function refocus(e: MouseEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "BUTTON" || tag === "TEXTAREA") return;
      scanInputRef.current?.focus();
    }
    document.addEventListener("click", refocus);
    scanInputRef.current?.focus();
    return () => document.removeEventListener("click", refocus);
  }, []);

  const barcodeIndex = useMemo(() => {
    const map = new Map<string, { product: Product; stock: StockRow }>();
    for (const p of products) {
      for (const s of p.stocks) {
        if (s.barcode) map.set(s.barcode, { product: p, stock: s });
      }
    }
    return map;
  }, [products]);

  // สินค้าที่มีสต๊อก (อย่างน้อย 1 ไซส์ที่ยังเหลือ) — แสดง 1 การ์ด/สินค้า
  const inStockProducts = useMemo(
    () => products.filter((p) => p.stocks.some((s) => s.quantity > 0)),
    [products],
  );

  function addToCart(product: Product, stock: StockRow) {
    if (!stock.barcode) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.stockId === stock.id);
      const alreadyInCart = existing?.quantity || 0;
      if (alreadyInCart + 1 > stock.quantity) {
        setScanError(`สินค้า "${product.name}${stock.size ? ` (ไซส์ ${stock.size})` : ""}" เหลือไม่พอ (คงเหลือ ${stock.quantity})`);
        return prev;
      }
      setScanError("");
      if (existing) {
        return prev.map((l) => (l.stockId === stock.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          barcode: stock.barcode!,
          stockId: stock.id,
          productName: product.name,
          size: stock.size,
          unitPrice: Number(product.price),
          quantity: 1,
          maxQuantity: stock.quantity,
        },
      ];
    });
  }

  async function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = scanValue.trim();
    setScanValue("");
    if (!code) return;

    const hit = barcodeIndex.get(code);
    if (hit) {
      addToCart(hit.product, hit.stock);
      return;
    }

    // Not in the preloaded catalog (e.g. a label generated after this page
    // loaded) — try a direct server lookup before giving up.
    setScanError("");
    try {
      const res = await fetch(`/api/admin/pos/lookup?barcode=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error || "ไม่พบสินค้าสำหรับบาร์โค้ดนี้");
        return;
      }
      addToCart(
        { id: data.productId, name: data.productName, price: data.price, requiresSize: !!data.size, stocks: [] },
        { id: data.stockId, size: data.size, quantity: data.quantity, barcode: data.barcode }
      );
      loadProducts();
    } catch {
      setScanError("ไม่สามารถค้นหาสินค้าได้ กรุณาลองใหม่");
    }
  }

  function addManualProduct() {
    const product = products.find((p) => p.id === manualProductId);
    if (!product) return;
    const size = product.requiresSize ? manualSize : "";
    const stock = product.stocks.find((s) => (s.size || "") === size);
    if (!stock || !stock.barcode) {
      setScanError("สินค้า/ไซส์นี้ยังไม่มีบาร์โค้ด กรุณาสร้างบาร์โค้ดในหน้าจัดการสินค้าก่อน");
      return;
    }
    addToCart(product, stock);
  }

  function updateQty(stockId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.stockId !== stockId) return l;
          const next = l.quantity + delta;
          if (next > l.maxQuantity) {
            setScanError(`สินค้า "${l.productName}${l.size ? ` (ไซส์ ${l.size})` : ""}" เหลือไม่พอ (คงเหลือ ${l.maxQuantity})`);
            return l;
          }
          return { ...l, quantity: next };
        })
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(stockId: string) {
    setCart((prev) => prev.filter((l) => l.stockId !== stockId));
  }

  // เพิ่มสินค้าจำนวนที่ระบุลงตะกร้าในครั้งเดียว (คุมสต๊อก + รวมกับที่มีอยู่)
  function addToCartQty(product: Product, stock: StockRow, qty: number) {
    if (!stock.barcode || qty < 1) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.stockId === stock.id);
      const already = existing?.quantity || 0;
      const capped = Math.min(qty, stock.quantity - already);
      if (capped <= 0) {
        setScanError(`สินค้า "${product.name}${stock.size ? ` (ไซส์ ${stock.size})` : ""}" เหลือไม่พอ (คงเหลือ ${stock.quantity})`);
        return prev;
      }
      setScanError("");
      if (existing) {
        return prev.map((l) => (l.stockId === stock.id ? { ...l, quantity: l.quantity + capped } : l));
      }
      return [
        ...prev,
        {
          barcode: stock.barcode!,
          stockId: stock.id,
          productName: product.name,
          size: stock.size,
          unitPrice: Number(product.price),
          quantity: capped,
          maxQuantity: stock.quantity,
        },
      ];
    });
  }

  // เปิด modal — เลือกไซส์ที่ยังมีของเป็นค่าเริ่มต้น จำนวนเริ่ม 1
  function openProductModal(product: Product) {
    const first =
      product.stocks.find((s) => s.quantity > 0 && s.barcode) ||
      product.stocks.find((s) => s.quantity > 0) ||
      null;
    setModalProduct(product);
    setModalStockId(first ? first.id : "");
    setModalQty(1);
    setScanError("");
  }
  function closeModal() {
    setModalProduct(null);
  }

  const total = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  // Only relevant when "โอนเงิน" is selected and there's an amount to
  // charge — a fresh dynamic PromptPay QR pre-filled with the exact total,
  // regenerated automatically as the cart changes. Payment is still
  // confirmed manually by the cashier (see lib/promptpay.ts) — this just
  // saves the customer from having to be told an account number.
  const promptPayPayload = useMemo(() => {
    if (paymentMethod !== "transfer" || !promptPayId || total <= 0) return null;
    try {
      return generatePromptPayPayload(promptPayId, total);
    } catch {
      return null;
    }
  }, [paymentMethod, promptPayId, total]);

  async function submitSale() {
    setSubmitError("");
    if (cart.length === 0) {
      setSubmitError("กรุณาสแกนสินค้าอย่างน้อย 1 รายการ");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/pos/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          buyerName: buyerName.trim() || undefined,
          buyerPhone: buyerPhone.trim() || undefined,
          items: cart.map((l) => ({ barcode: l.barcode, quantity: l.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "บันทึกการขายไม่สำเร็จ");
        loadProducts();
        return;
      }
      router.push(`/admin/pos/receipt/${data.sale.id}`);
    } catch {
      setSubmitError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedProduct = products.find((p) => p.id === manualProductId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">ขายหน้างาน (POS)</h1>
          <p className="text-sm text-stone-500 mt-0.5">สแกนบาร์โค้ดสินค้า รับชำระเงิน แล้วพิมพ์ใบเสร็จ</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/pos/package" className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors">
            ขายแพ็กเกจ (จองโต๊ะ+ของแถม)
          </Link>
          <Link href="/admin/pos/sales" className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors">
            ประวัติการขาย
          </Link>
          <Link href="/admin/merch/products" className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors">
            จัดการสินค้า/บาร์โค้ด
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <form onSubmit={handleScanSubmit} className="bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">สแกนบาร์โค้ด</span>
              <input
                ref={scanInputRef}
                autoFocus
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                placeholder="สแกนด้วยเครื่องอ่านบาร์โค้ด หรือพิมพ์รหัสแล้วกด Enter"
                className="border-2 border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-3 text-lg font-mono"
              />
            </label>
            {scanError && <p className="text-red-600 text-sm">{scanError}</p>}

            <details className="pt-1">
              <summary className="text-xs text-stone-500 cursor-pointer select-none">เครื่องสแกนใช้ไม่ได้? เพิ่มสินค้าด้วยมือ</summary>
              <div className="flex flex-wrap items-end gap-2 pt-2">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-stone-500">สินค้า</span>
                  <select
                    value={manualProductId}
                    onChange={(e) => {
                      setManualProductId(e.target.value);
                      setManualSize("");
                    }}
                    className="border border-stone-300 rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value="">-- เลือกสินค้า --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedProduct?.requiresSize && (
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-stone-500">ไซส์</span>
                    <select value={manualSize} onChange={(e) => setManualSize(e.target.value)} className="border border-stone-300 rounded-lg px-2 py-1.5 text-sm">
                      <option value="">-- เลือกไซส์ --</option>
                      {selectedProduct.stocks.map((s) => (
                        <option key={s.id} value={s.size || ""}>
                          {s.size} (คงเหลือ {s.quantity})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  onClick={addManualProduct}
                  disabled={!manualProductId}
                  className="bg-stone-700 hover:bg-stone-800 transition-colors text-white text-sm rounded-lg px-3 py-1.5 font-medium disabled:opacity-50"
                >
                  + เพิ่ม
                </button>
              </div>
            </details>
          </form>

          <div className="bg-white rounded-xl border border-cream-200 shadow-md p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-stone-800">สินค้าในสต๊อก — แตะเพื่อเพิ่ม</h2>
              <span className="text-xs text-stone-400">{inStockProducts.length} รายการ</span>
            </div>
            {inStockProducts.length === 0 ? (
              <div className="text-sm text-stone-400 text-center py-6">ยังไม่มีสินค้าที่มีสต๊อก</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {inStockProducts.map((product) => {
                  const remaining = product.stocks.reduce((n, x) => n + (x.quantity > 0 ? x.quantity : 0), 0);
                  const sizeCount = product.stocks.filter((x) => x.quantity > 0).length;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => openProductModal(product)}
                      className="border border-cream-200 rounded-lg p-3 flex flex-col text-left bg-cream-50 hover:border-primary-400 hover:shadow-sm transition-all"
                    >
                      <div className="font-medium text-stone-800 text-sm leading-snug">{product.name}</div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        {product.requiresSize ? `${sizeCount} ไซส์ · ` : ""}คงเหลือ {remaining}
                      </div>
                      <div className="text-maroon-700 font-semibold text-sm mt-1">{Number(product.price).toLocaleString()} บาท</div>
                      <div className="mt-2 text-xs text-primary-700 font-medium">แตะเพื่อเลือก →</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-cream-200 shadow-md p-5">
            <h2 className="font-display font-semibold text-stone-800 mb-3">ตะกร้าสินค้า ({cart.length} รายการ)</h2>
            {cart.length === 0 ? (
              <div className="text-sm text-stone-400 text-center py-8">ยังไม่มีสินค้าในตะกร้า — สแกนบาร์โค้ดเพื่อเริ่มขาย</div>
            ) : (
              <div className="space-y-2">
                {cart.map((l) => (
                  <div key={l.stockId} className="flex items-center justify-between gap-3 border-b border-cream-100 pb-2 last:border-0">
                    <div className="min-w-0">
                      <div className="font-medium text-stone-800 truncate">
                        {l.productName}
                        {l.size && <span className="text-stone-500"> (ไซส์ {l.size})</span>}
                      </div>
                      <div className="text-xs text-stone-400">{l.unitPrice.toLocaleString()} บาท/ชิ้น</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => updateQty(l.stockId, -1)} className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold">
                        -
                      </button>
                      <span className="w-6 text-center font-medium">{l.quantity}</span>
                      <button onClick={() => updateQty(l.stockId, 1)} className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold">
                        +
                      </button>
                      <span className="w-20 text-right font-semibold text-maroon-700">{(l.unitPrice * l.quantity).toLocaleString()}</span>
                      <button onClick={() => removeLine(l.stockId)} className="text-red-600 hover:text-red-700 text-xs">
                        ลบ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-3 lg:sticky lg:top-4">
            <h2 className="font-display font-semibold text-stone-800">ชำระเงิน</h2>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">ชื่อผู้ซื้อ (ถ้ามี)</span>
              <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">เบอร์โทร (ถ้ามี)</span>
              <input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2" />
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
                    <div className="text-xs text-stone-500 mt-2">ให้ลูกค้าสแกนจ่ายยอด {total.toLocaleString()} บาท แล้วตรวจสอบว่าเงินเข้าก่อนกดยืนยันการขาย</div>
                  </>
                ) : (
                  <div className="text-xs text-stone-400">
                    {promptPayId ? "เพิ่มสินค้าลงตะกร้าก่อนเพื่อสร้าง QR" : "ยังไม่ได้ตั้งค่าเลขพร้อมเพย์ — ตั้งค่าได้ที่หน้าจัดการสินค้า/สต๊อก"}
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-cream-200 pt-3 flex items-center justify-between">
              <span className="font-display font-semibold text-stone-800">ยอดรวม</span>
              <span className="text-2xl font-bold text-maroon-700">{total.toLocaleString()} บาท</span>
            </div>

            {submitError && <p className="text-red-600 text-sm">{submitError}</p>}

            <button
              onClick={submitSale}
              disabled={submitting || cart.length === 0}
              className="w-full bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg py-3 font-semibold disabled:opacity-50"
            >
              {submitting ? "กำลังบันทึก..." : "ยืนยันการขาย + พิมพ์ใบเสร็จ"}
            </button>
          </div>
        </div>
      </div>

      {modalProduct &&
        (() => {
          const p = modalProduct;
          const stock = p.stocks.find((x) => x.id === modalStockId) || null;
          const inCart = stock ? cart.find((l) => l.stockId === stock.id)?.quantity || 0 : 0;
          const maxAddable = stock ? Math.max(0, stock.quantity - inCart) : 0;
          const canAdd = !!stock && !!stock.barcode && modalQty >= 1 && modalQty <= maxAddable;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
              <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
              <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display font-semibold text-stone-800 text-lg">{p.name}</h3>
                    <div className="text-maroon-700 font-semibold">{Number(p.price).toLocaleString()} บาท/ชิ้น</div>
                  </div>
                  <button type="button" onClick={closeModal} className="text-stone-400 hover:text-stone-600 text-xl leading-none">
                    ✕
                  </button>
                </div>

                {p.requiresSize && (
                  <div>
                    <div className="text-sm font-medium text-stone-700 mb-1">เลือกไซส์</div>
                    <div className="flex flex-wrap gap-2">
                      {p.stocks.map((x) => {
                        const disabled = x.quantity <= 0 || !x.barcode;
                        const active = x.id === modalStockId;
                        return (
                          <button
                            key={x.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              setModalStockId(x.id);
                              setModalQty(1);
                            }}
                            className={`rounded-lg px-3 py-2 text-sm border transition-colors ${
                              active
                                ? "bg-maroon-700 text-white border-maroon-700"
                                : "bg-white text-stone-700 border-stone-300 hover:bg-cream-50"
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            {x.size || "-"} <span className="text-xs opacity-70">({x.quantity})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {p.requiresSize && (
                  <details className="text-sm">
                    <summary className="cursor-pointer select-none text-primary-700 font-medium">ดูตารางไซซ์</summary>
                    <div className="mt-2">
                      <SizeChart />
                    </div>
                  </details>
                )}

                <div>
                  <div className="text-sm font-medium text-stone-700 mb-1">จำนวน</div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                      className="w-10 h-10 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-lg font-bold"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={maxAddable || 1}
                      value={modalQty}
                      onChange={(e) =>
                        setModalQty(Math.max(1, Math.min(maxAddable || 1, Number(e.target.value) || 1)))
                      }
                      className="w-20 text-center border border-stone-300 rounded-lg px-2 py-2 text-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setModalQty((q) => Math.min(maxAddable || 1, q + 1))}
                      className="w-10 h-10 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-lg font-bold"
                    >
                      +
                    </button>
                    <span className="text-sm text-stone-500">
                      คงเหลือ {stock ? stock.quantity : 0}
                      {inCart > 0 ? ` · ในตะกร้าแล้ว ${inCart}` : ""}
                    </span>
                  </div>
                </div>

                {stock && !stock.barcode && (
                  <p className="text-sm text-amber-600">ไซส์นี้ยังไม่มีบาร์โค้ด เพิ่มไม่ได้ (สร้างบาร์โค้ดในหน้าจัดการสินค้าก่อน)</p>
                )}
                {p.requiresSize && !stock && <p className="text-sm text-stone-500">กรุณาเลือกไซส์</p>}
                {stock && !!stock.barcode && maxAddable === 0 && (
                  <p className="text-sm text-amber-600">เพิ่มครบจำนวนคงเหลือแล้ว</p>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="text-sm text-stone-500">
                    รวม: <span className="font-semibold text-maroon-700">{(Number(p.price) * modalQty).toLocaleString()} บาท</span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={closeModal} className="rounded-lg px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-cream-50">
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      disabled={!canAdd}
                      onClick={() => {
                        if (stock) {
                          addToCartQty(p, stock, modalQty);
                          closeModal();
                        }
                      }}
                      className="rounded-lg px-5 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50"
                    >
                      เพิ่มลงตะกร้า
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
