"use client";
import { useState } from "react";
import { zoneColor, registerZones } from "@/lib/zone-colors";
import { zoneKey } from "@/lib/floor-plan-zoom";
import type { TableRow } from "./table-graphic";

// ตำแหน่งโต๊ะบน "ภาพแผนผังการจัดงาน" (ภาพนิ่งที่อัปโหลดไว้ ขนาดอ้างอิง 1199×1312 px)
// ใช้คู่กับโซนของโต๊ะจากฐานข้อมูล เพื่อคำนวณกรอบสี่เหลี่ยมของแต่ละโซนตอนเอาเมาส์ชี้
// ถ้าเปลี่ยนภาพแผนผังเป็นภาพอื่นที่สัดส่วนต่างไป กรอบจะไม่แสดง (ป้องกันกรอบผิดที่)
const REF_W = 1199;
const REF_H = 1312;
const ROWS = [234, 276, 320, 364, 407, 452, 497, 541, 585, 630, 674, 719];

const PX: Record<number, [number, number]> = {};
function col(x: number, start: number, count: number, firstRow = 0) {
  for (let i = 0; i < count; i++) PX[start + i] = [x, ROWS[firstRow + i]];
}
col(365, 1, 12);
col(423, 13, 12);
col(481, 25, 12);
col(529, 38, 9, 3);
col(569, 47, 12);
col(628, 59, 12);
col(686, 71, 12);
col(742, 83, 12);
col(799, 95, 12);
col(859, 107, 12);
col(919, 119, 12);
col(302, 131, 6, 6);
col(238, 137, 4, 8);
// แถวล่าง (y = 765, 810, 858)
const BOTTOM: [number, number[]][] = [
  [302, [141, 142]],
  [363, [143, 144, 145]],
  [422, [147, 148, 146]],
  [477, [151, 152, 153]],
  [529, [155, 154, 156]],
  [578, [157, 158, 159]],
  [631, [160, 150, 149]],
  [687, [163, 164]],
  [742, [165, 166, 172]],
  [799, [167, 168, 173]],
  [860, [161, 162, 174]],
  [919, [170, 171, 169]],
];
const BOTTOM_Y = [765, 810, 858];
for (const [x, nums] of BOTTOM) nums.forEach((n, i) => (PX[n] = [x, BOTTOM_Y[i]]));

const PAD_X = 2.6; // % ของความกว้างภาพ (ประมาณรัศมีโต๊ะ)
const PAD_Y = (PAD_X * REF_W) / REF_H;

export default function LayoutImageWithZones({ src, tables }: { src: string; tables: TableRow[] }) {
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  registerZones(tables.map((t) => t.zone));
  const pts: { key: string; x: number; y: number }[] = [];
  const stats = new Map<string, { zone: string | null; free: number; total: number }>();
  const boxes = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
  for (const t of tables) {
    const k = zoneKey(t.zone);
    const s = stats.get(k) ?? { zone: t.zone, free: 0, total: 0 };
    s.total += 1;
    if (!(t.isFullTableBooking || t.seatsReserved > 0)) s.free += 1;
    stats.set(k, s);
    const p = PX[Number(t.tableNumber)];
    if (!p) continue;
    const x = (p[0] / REF_W) * 100;
    const y = (p[1] / REF_H) * 100;
    pts.push({ key: k, x, y });
    const b = boxes.get(k);
    if (!b) boxes.set(k, { x0: x, y0: y, x1: x, y1: y });
    else {
      b.x0 = Math.min(b.x0, x);
      b.y0 = Math.min(b.y0, y);
      b.x1 = Math.max(b.x1, x);
      b.y1 = Math.max(b.y1, y);
    }
  }

  function pick(e: React.MouseEvent<HTMLDivElement>) {
    if (!ready) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    const cand = new Set<string>();
    boxes.forEach((b, k) => {
      if (x >= b.x0 - PAD_X && x <= b.x1 + PAD_X && y >= b.y0 - PAD_Y && y <= b.y1 + PAD_Y) cand.add(k);
    });
    let best: string | null = null;
    let bestD = Infinity;
    for (const p of pts) {
      if (!cand.has(p.key)) continue;
      const dx = (x - p.x) * (REF_W / REF_H);
      const dy = y - p.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = p.key;
      }
    }
    setHover((prev) => (prev === best ? prev : best));
  }

  const b = hover !== null ? boxes.get(hover) : undefined;
  const st = hover !== null ? stats.get(hover) : undefined;
  const color = zoneColor(st?.zone ?? null).bg;
  const left = b ? Math.max(0, b.x0 - PAD_X) : 0;
  const top = b ? Math.max(0, b.y0 - PAD_Y) : 0;
  const width = b ? Math.min(100, b.x1 + PAD_X) - left : 0;
  const height = b ? Math.min(100, b.y1 + PAD_Y) - top : 0;
  const labelInside = top < 6;

  return (
    <div
      className="relative w-fit max-w-full cursor-default"
      onClick={(e) => {
        e.stopPropagation();
        pick(e);
      }}
      onMouseMove={pick}
      onMouseLeave={() => setHover(null)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="แผนผังการจัดงาน"
        className="block max-w-full max-h-[calc(100vh-24px)] object-contain"
        onLoad={(e) => {
          const im = e.currentTarget;
          setReady(im.naturalWidth > 0 && Math.abs(im.naturalWidth / im.naturalHeight - REF_W / REF_H) < 0.01);
        }}
      />
      {b && st && (
        <div className="pointer-events-none absolute" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}>
          <div className="absolute inset-0 rounded-lg" style={{ background: color, opacity: 0.14 }} />
          <div className="absolute inset-0 rounded-lg" style={{ border: `3px solid ${color}` }} />
          <span
            className="absolute left-0 whitespace-nowrap rounded-md px-2 py-0.5 text-xs sm:text-sm font-semibold text-white shadow-md"
            style={{ background: color, ...(labelInside ? { top: 4, left: 4 } : { top: 0, transform: "translateY(-100%)" }) }}
          >
            {st.zone ? `โซน ${st.zone}` : "ไม่ระบุโซน"} · ว่าง {st.free}/{st.total}
          </span>
        </div>
      )}
    </div>
  );
}
