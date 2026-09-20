"use client";

// กราฟ SVG เบา ๆ สำหรับแดชบอร์ดแอดมิน (ไม่พึ่งไลบรารีกราฟ)
// สีอ่านจากตัวแปรธีม (--c-*) ผ่านสตริง rgb(var(--c-…)) จึงเปลี่ยนตามธีมที่ตั้งใน /admin/settings
import { useState } from "react";

export const themeColor = (name: string, step: number) => `rgb(var(--c-${name}-${step}))`;

export interface LinePoint {
  label: string; // ป้ายแกน X
  tip: string; // ข้อความใน tooltip
  value: number;
}

/** กราฟเส้นพื้นที่ชุดเดียว + เส้นนำสายตา/tooltip เมื่อชี้เมาส์หรือแตะ */
export function LineAreaChart({
  points,
  color = themeColor("maroon", 500),
  ariaLabel,
  labelEvery = 1,
}: {
  points: LinePoint[];
  color?: string;
  ariaLabel: string;
  labelEvery?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 260;
  const L = 40;
  const R = 16;
  const T = 16;
  const B = 32;
  const n = points.length;
  const rawMax = Math.max(1, ...points.map((p) => p.value));
  // ปัดแกน Y ให้เป็นเลขกลม (4 ช่อง)
  const step = Math.max(1, Math.ceil(rawMax / 4));
  const max = step * 4;
  const x = (i: number) => (n <= 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const area = `${x(0)},${y(0)} ${line} ${x(n - 1)},${y(0)}`;
  const peak = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);

  function onMove(e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const px = ((cx - rect.left) / rect.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label={ariaLabel}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={onMove}
        onTouchMove={onMove}
        onTouchEnd={() => setHover(null)}
      >
        <defs>
          <linearGradient id="dash-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: color, stopOpacity: 0.22 }} />
            <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((g) => {
          const v = g * step;
          return (
            <g key={g}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} style={{ stroke: themeColor("cream", 200) }} strokeWidth={1} />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill="#78716c">
                {v}
              </text>
            </g>
          );
        })}
        {n > 1 && <polygon points={area} fill="url(#dash-area)" />}
        <polyline points={line} fill="none" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: color }} />
        {points.map((p, i) => (
          <g key={i}>
            {i % labelEvery === 0 && (
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={12.5} fill="#78716c">
                {p.label}
              </text>
            )}
            {n <= 14 && <circle cx={x(i)} cy={y(p.value)} r={4} strokeWidth={2} style={{ fill: color, stroke: "#fff" }} />}
          </g>
        ))}
        {n > 0 && points[peak].value > 0 && (
          <text x={Math.min(x(peak), W - R - 4)} y={y(points[peak].value) - 12} textAnchor="middle" fontSize={13} fontWeight={700} fill="#292524">
            {points[peak].value}
          </text>
        )}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#a8a29e" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(points[hover].value)} r={5.5} strokeWidth={2.5} style={{ fill: "#fff", stroke: color }} />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-stone-800 px-2.5 py-1.5 text-xs text-white whitespace-nowrap shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(points[hover].value) / H) * 100}%`, marginTop: -10 }}
        >
          {points[hover].tip}
        </div>
      )}
    </div>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** วงแหวนสัดส่วน + ตัวเลขรวมตรงกลาง (legend แยกไปวาดที่ฝั่งหน้า) */
export function DonutChart({ slices, centerLabel, ariaLabel }: { slices: DonutSlice[]; centerLabel: string; ariaLabel: string }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const r = 72;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 190 190" className="w-44 h-44" role="img" aria-label={ariaLabel}>
      {total === 0 ? (
        <circle cx={95} cy={95} r={r} fill="none" strokeWidth={26} style={{ stroke: themeColor("cream", 200) }} />
      ) : (
        slices
          .filter((s) => s.value > 0)
          .map((s) => {
            const len = (s.value / total) * circ;
            const dash = Math.max(len - 2, 0.5); // เว้น 2px ระหว่างชิ้น
            const el = (
              <circle
                key={s.label}
                cx={95}
                cy={95}
                r={r}
                fill="none"
                strokeWidth={26}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 95 95)"
                style={{ stroke: s.color }}
              >
                <title>{`${s.label} ${s.value.toLocaleString()} รายการ`}</title>
              </circle>
            );
            offset += len;
            return el;
          })
      )}
      <text x={95} y={94} textAnchor="middle" fontSize={28} fontWeight={700} fill="#292524">
        {total.toLocaleString()}
      </text>
      <text x={95} y={114} textAnchor="middle" fontSize={13} fill="#78716c">
        {centerLabel}
      </text>
    </svg>
  );
}
