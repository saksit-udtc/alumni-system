// Assigns each zone name a consistent color from a fixed palette, derived
// by hashing the name — so "VIP" always gets the same color everywhere
// (grid view, floor plan markers, admin editor) without the admin having
// to pick a color manually. Same zone name -> same color, deterministically.
//
// Ported near-verbatim from the old Supabase app's lib/zone-colors.ts.
const PALETTE = [
  { bg: "#3b82f6", text: "#1e3a8a", label: "blue" },
  { bg: "#f97316", text: "#7c2d12", label: "orange" },
  { bg: "#ec4899", text: "#831843", label: "pink" },
  { bg: "#8b5cf6", text: "#4c1d95", label: "violet" },
  { bg: "#06b6d4", text: "#164e63", label: "cyan" },
  { bg: "#92400e", text: "#451a03", label: "brown" },
  { bg: "#d946ef", text: "#701a75", label: "fuchsia" },
  { bg: "#475569", text: "#0f172a", label: "slate-dark" },
  { bg: "#0d9488", text: "#134e4a", label: "teal" },
  { bg: "#4338ca", text: "#1e1b4b", label: "indigo" },
  { bg: "#be123c", text: "#4c0519", label: "crimson" },
  { bg: "#65a30d", text: "#1a2e05", label: "olive" },
  { bg: "#0369a1", text: "#082f49", label: "deep-sky" },
  { bg: "#7e22ce", text: "#3b0764", label: "purple" },
  { bg: "#f59e0b", text: "#78350f", label: "amber" },
  { bg: "#10b981", text: "#064e3b", label: "emerald" },
];

// ลงทะเบียนรายชื่อโซนของงานนี้ เพื่อให้แต่ละโซนได้สีไม่ซ้ำกัน
// (เรียงชื่อโซนแล้วไล่แจกสีตามลำดับ — ผลเหมือนเดิมทุกครั้งไม่ว่าข้อมูลมาลำดับไหน)
// ถ้าโซนมากกว่าจำนวนสีใน PALETTE สีจะเริ่มวนซ้ำ
let assigned = new Map<string, number>();
export function registerZones(zoneNames: (string | null | undefined)[]) {
  const names = Array.from(new Set(zoneNames.filter((z): z is string => !!z && !OVERRIDE_RE.test(z)))).sort((a, b) =>
    a.localeCompare(b, "th", { numeric: true })
  );
  assigned = new Map(names.map((n, i) => [n, i % PALETTE.length]));
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// Fixed color for zone names that match a well-known category, checked
// before falling back to the hash-based palette. Matches case-insensitively
// and by substring, so "VIP", "โซน VIP", "vip zone" all get the same color.
const OVERRIDE_RE = /vip/i;
const YELLOW = { bg: "#eab308", text: "#713f12", label: "yellow" };
const OVERRIDES: { pattern: RegExp; color: typeof YELLOW }[] = [{ pattern: OVERRIDE_RE, color: YELLOW }];

export function zoneColor(zoneName: string | null | undefined) {
  if (!zoneName) return { bg: "#94a3b8", text: "#334155", label: "slate" }; // ไม่ระบุโซน
  const override = OVERRIDES.find((o) => o.pattern.test(zoneName));
  if (override) return override.color;
  const idx = assigned.get(zoneName);
  return PALETTE[idx ?? hashString(zoneName) % PALETTE.length];
}
