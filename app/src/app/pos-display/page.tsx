"use client";

import { useEffect, useState } from "react";
import QrCode from "@/app/components/qr-code";
import { readDisplay, subscribeDisplay, type DisplayLine, type DisplayState } from "@/lib/posDisplay";

// จอลูกค้า (จอที่สอง) — แสดงรายการสินค้า/ยอดรวม และ QR ชำระเงิน
// รับข้อมูลจากหน้าขาย (/admin/pos) ที่เปิดในเบราว์เซอร์เครื่องเดียวกันเท่านั้น ไม่เรียกข้อมูลจากเซิร์ฟเวอร์

const baht = (n: number) => n.toLocaleString("th-TH");

function Lines({ lines, big }: { lines: DisplayLine[]; big?: boolean }) {
  return (
    <div className="divide-y divide-white/15">
      {lines.map((l, i) => (
        <div key={i} className={`flex items-start justify-between gap-4 ${big ? "py-4 text-3xl" : "py-3 text-2xl"}`}>
          <div className="min-w-0">
            <div className="font-semibold break-words">
              {l.name}
              {l.size ? <span className="ml-2 text-white/70">({l.size})</span> : null}
            </div>
            <div className="text-white/70 text-xl mt-0.5">
              {baht(l.unitPrice)} × {l.qty}
            </div>
          </div>
          <div className="shrink-0 font-bold">{baht(l.unitPrice * l.qty)}</div>
        </div>
      ))}
    </div>
  );
}

export default function PosCustomerDisplayPage() {
  const [state, setState] = useState<DisplayState>({ kind: "idle" });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [qrSize, setQrSize] = useState(360);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    setState(readDisplay());
    return subscribeDisplay(setState);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fit = () => setQrSize(Math.max(240, Math.min(520, Math.floor(Math.min(window.innerHeight * 0.55, window.innerWidth * 0.4)))));
    fit();
    window.addEventListener("resize", fit);
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("resize", fit);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  // กันจอดับ/พักหน้าจอ (ถ้าเบราว์เซอร์รองรับ)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const req = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lock = await (navigator as any).wakeLock?.request("screen");
      } catch {}
    };
    req();
    const onVis = () => document.visibilityState === "visible" && req();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);

  // สถานะที่หมดอายุเอง: "ชำระแล้ว" แสดง 6 วินาที, รายการรอชำระหมดเวลากันสินค้า
  let view: DisplayState = state;
  if (state.kind === "paid" && nowMs - state.at > 6000) view = { kind: "idle" };
  if (state.kind === "pay" && state.holdUntil && nowMs >= new Date(state.holdUntil).getTime()) view = { kind: "idle" };

  const remainMs = view.kind === "pay" && view.holdUntil ? new Date(view.holdUntil).getTime() - nowMs : 0;
  const mm = String(Math.max(0, Math.floor(remainMs / 60000))).padStart(2, "0");
  const ss = String(Math.max(0, Math.floor((remainMs % 60000) / 1000))).padStart(2, "0");

  return (
    <div className="min-h-screen bg-gradient-to-br from-maroon-800 to-maroon-900 text-white flex flex-col select-none cursor-default">
      {!fullscreen && (
        <button
          onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
          className="fixed top-3 right-3 z-10 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-sm"
        >
          เต็มจอ
        </button>
      )}

      {view.kind === "idle" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="text-5xl md:text-6xl font-display font-bold">ยินดีต้อนรับ</div>
          <div className="text-2xl md:text-3xl mt-4 text-white/80">งานคืนสู่เหย้า</div>
        </div>
      )}

      {view.kind === "cart" && (
        <div className="flex-1 flex flex-col p-6 md:p-10 max-w-5xl w-full mx-auto">
          <div className="text-2xl text-white/80 mb-2">รายการสินค้าของท่าน</div>
          <div className="flex-1 overflow-y-auto">
            <Lines lines={view.lines} big />
          </div>
          <div className="border-t-2 border-white/40 pt-4 mt-4 flex items-end justify-between">
            <div className="text-3xl">ยอดรวม</div>
            <div className="text-6xl md:text-7xl font-bold">
              {baht(view.total)} <span className="text-3xl font-normal">บาท</span>
            </div>
          </div>
        </div>
      )}

      {view.kind === "pay" && (
        <div className="flex-1 grid md:grid-cols-2 gap-6 p-6 md:p-10 items-center">
          <div className="flex flex-col h-full max-h-[85vh]">
            <div className="text-2xl text-white/80 mb-2">รายการสินค้าของท่าน</div>
            <div className="flex-1 overflow-y-auto">
              <Lines lines={view.lines} />
            </div>
            <div className="border-t-2 border-white/40 pt-3 mt-3 flex items-end justify-between">
              <div className="text-2xl">ยอดรวม</div>
              <div className="text-5xl font-bold">
                {baht(view.total)} <span className="text-2xl font-normal">บาท</span>
              </div>
            </div>
          </div>

          <div className="bg-white text-stone-800 rounded-3xl p-6 md:p-8 flex flex-col items-center text-center shadow-2xl">
            {view.method === "transfer" && view.qrPayload ? (
              <>
                <div className="text-3xl font-bold text-maroon-700 mb-3">สแกน QR เพื่อชำระเงิน</div>
                <div className="bg-white p-2 rounded-xl border border-stone-200">
                  <QrCode value={view.qrPayload} size={qrSize} />
                </div>
                <div className="text-5xl font-bold text-maroon-700 mt-4">{baht(view.total)} บาท</div>
                <div className="text-xl text-stone-500 mt-2">PromptPay · เปิดแอปธนาคารแล้วสแกนได้เลย</div>
              </>
            ) : view.method === "transfer" ? (
              <>
                <div className="text-3xl font-bold text-maroon-700">กรุณารอสักครู่</div>
                <div className="text-5xl font-bold text-maroon-700 mt-4">{baht(view.total)} บาท</div>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-maroon-700">ชำระด้วยเงินสด</div>
                <div className="text-7xl font-bold text-maroon-700 mt-6">{baht(view.total)}</div>
                <div className="text-3xl text-stone-600 mt-1">บาท</div>
              </>
            )}
            {view.holdUntil && (
              <div className="text-lg text-stone-400 mt-4">
                เหลือเวลา <span className="font-mono">{mm}:{ss}</span> นาที
              </div>
            )}
          </div>
        </div>
      )}

      {view.kind === "paid" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-32 h-32 rounded-full bg-emerald-500 flex items-center justify-center">
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5 9-10" />
            </svg>
          </div>
          <div className="text-5xl md:text-6xl font-display font-bold mt-8">ชำระเงินเรียบร้อย</div>
          <div className="text-3xl mt-3 text-white/80">ขอบคุณที่อุดหนุนครับ/ค่ะ</div>
        </div>
      )}
    </div>
  );
}
