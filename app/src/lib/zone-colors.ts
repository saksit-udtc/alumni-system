// Assigns each zone name a consistent color from a fixed palette, derived
// by hashing the name — so "VIP" always gets the same color everywhere
// (grid view, floor plan markers, admin editor) without the admin having
// to pick a color manually. Same zone name -> same color, deterministically.
//
// Ported near-verbatim from the old Supabase app's lib/zone-colors.ts.
const PALETTE = [
  { bg: "#f59e0b", text: "#78350f", label: "amber" }, // VIP-ish gold
  { bg: "#3b82f6", text: "#1e3a8a", label: "blue" },
  { bg: "#10b981", text: "#064e3b", label: "emerald" },
  { bg: "#ec4899", text: "#831843", label: "pink" },
  { bg: "#8b5cf6", text: "#4c1d95", label: "violet" },
  { bg: "#f97316", text: "#7c2d12", label: "orange" },
  { bg: "#06b6d4", text: "#164e63", label: "cyan" },
  { bg: "#84cc16", text: "#365314", label: "lime" },
  { bg: "#ef4444", text: "#7f1d1d", label: "red" },
  { bg: "#6366f1", text: "#312e81", label: "indigo" },
];

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
const YELLOW = { bg: "#eab308", text: "#713f12", label: "yellow" };
const OVERRIDES: { pattern: RegExp; color: typeof YELLOW }[] = [{ pattern: /vip/i, color: YELLOW }];

export function zoneColor(zoneName: string | null | undefined) {
  if (!zoneName) return { bg: "#94a3b8", text: "#334155", label: "slate" }; // ไม่ระบุโซน
  const override = OVERRIDES.find((o) => o.pattern.test(zoneName));
  if (override) return override.color;
  return PALETTE[hashString(zoneName) % PALETTE.length];
}
