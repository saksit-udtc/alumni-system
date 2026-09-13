"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import JsBarcode from "jsbarcode";

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

interface LabelJob {
  key: string;
  productName: string;
  size: string | null;
  price: string;
  barcode: string;
}

function BarcodeLabel({ job }: { job: LabelJob }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, job.barcode, {
        format: "CODE128",
        displayValue: true,
        height: 30,
        width: 1.3,
        fontSize: 10,
        margin: 2,
      });
    } catch {
      // Non-fatal — label still shows the product name/price as text.
    }
  }, [job.barcode]);

  return (
    <div className="border border-stone-300 rounded-md p-2 flex flex-col items-center text-center break-inside-avoid" style={{ width: "6.4cm" }}>
      <div className="text-xs font-semibold text-stone-800 leading-tight">
        {job.productName}
        {job.size ? ` (${job.size})` : ""}
      </div>
      <div className="text-xs text-stone-600 mb-0.5">{Number(job.price).toLocaleString()} บาท</div>
      <svg ref={ref} />
    </div>
  );
}

export default function BarcodeLabelsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({}); // stockId -> copies
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState("");

  function load() {
    fetch("/api/admin/pos/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []));
  }
  useEffect(load, []);

  async function generateBarcode(stockId: string, regenerate = false) {
    setGenerating(stockId);
    setError("");
    try {
      const res = await fetch("/api/admin/pos/products/generate-barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockId, regenerate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "สร้างบาร์โค้ดไม่สำเร็จ");
        return;
      }
      load();
    } finally {
      setGenerating(null);
    }
  }

  function toggleSelect(stockId: string, checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[stockId] = next[stockId] || 1;
      else delete next[stockId];
      return next;
    });
  }

  function setCopies(stockId: string, copies: number) {
    setSelected((prev) => ({ ...prev, [stockId]: Math.max(1, Math.min(50, copies)) }));
  }

  const jobs: LabelJob[] = [];
  for (const p of products) {
    for (const s of p.stocks) {
      const copies = selected[s.id];
      if (!copies || !s.barcode) continue;
      for (let i = 0; i < copies; i++) {
        jobs.push({ key: `${s.id}-${i}`, productName: p.name, size: s.size, price: p.price, barcode: s.barcode });
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="print:hidden flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">พิมพ์ป้ายบาร์โค้ด</h1>
          <p className="text-sm text-stone-500 mt-0.5">สร้างบาร์โค้ดให้สินค้า/ไซส์ที่ยังไม่มี แล้วเลือกจำนวนป้ายที่จะพิมพ์</p>
        </div>
        <Link href="/admin/merch/products" className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors">
          กลับไปจัดการสินค้า
        </Link>
      </div>

      {error && <p className="print:hidden text-red-600 text-sm">{error}</p>}

      <div className="print:hidden bg-white rounded-xl border border-cream-200 shadow-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-cream-50 text-stone-500 text-left">
            <tr>
              <th className="px-4 py-2.5">สินค้า</th>
              <th className="px-4 py-2.5">ไซส์</th>
              <th className="px-4 py-2.5">คงเหลือ</th>
              <th className="px-4 py-2.5">บาร์โค้ด</th>
              <th className="px-4 py-2.5">จำนวนป้าย</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {products.flatMap((p) =>
              p.stocks.map((s) => (
                <tr key={s.id} className="border-t border-cream-100">
                  <td className="px-4 py-2.5">{p.name}</td>
                  <td className="px-4 py-2.5">{s.size || "-"}</td>
                  <td className="px-4 py-2.5">{s.quantity}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{s.barcode || <span className="text-stone-400">ยังไม่มี</span>}</td>
                  <td className="px-4 py-2.5">
                    {s.barcode && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={s.id in selected}
                          onChange={(e) => toggleSelect(s.id, e.target.checked)}
                          className="accent-maroon-700"
                        />
                        <input
                          type="number"
                          min={1}
                          max={50}
                          disabled={!(s.id in selected)}
                          value={selected[s.id] || 1}
                          onChange={(e) => setCopies(s.id, Number(e.target.value) || 1)}
                          className="w-16 border border-stone-300 rounded-lg px-2 py-1 text-sm disabled:bg-stone-100"
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => generateBarcode(s.id, !!s.barcode)}
                      disabled={generating === s.id}
                      className="text-xs bg-stone-700 hover:bg-stone-800 transition-colors text-white rounded-lg px-2.5 py-1.5 font-medium disabled:opacity-50"
                    >
                      {generating === s.id ? "..." : s.barcode ? "สร้างใหม่" : "สร้างบาร์โค้ด"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="print:hidden">
        <button
          onClick={() => window.print()}
          disabled={jobs.length === 0}
          className="bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
        >
          พิมพ์ป้าย ({jobs.length} ดวง)
        </button>
      </div>

      {jobs.length > 0 && (
        <div className="flex flex-wrap gap-2 print:gap-1 bg-white print:bg-transparent rounded-xl border print:border-0 border-cream-200 shadow-md print:shadow-none p-4 print:p-0">
          {jobs.map((job) => (
            <BarcodeLabel key={job.key} job={job} />
          ))}
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page {
            margin: 0.5cm;
          }
        }
      `}</style>
    </div>
  );
}
