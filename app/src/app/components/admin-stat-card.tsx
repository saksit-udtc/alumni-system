// Shared stat-card used across every /admin/* overview grid (dashboard,
// events list, event detail, reservations, merch orders). Colored icon +
// matching top border so each metric is visually distinct at a glance —
// mirrors the tone system introduced on the main dashboard.
export type StatTone = "indigo" | "rose" | "emerald" | "amber" | "sky" | "violet" | "slate";

const TONE_BG: Record<StatTone, string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  rose: "bg-rose-50 text-rose-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
  slate: "bg-stone-100 text-stone-500",
};

const TONE_BORDER: Record<StatTone, string> = {
  indigo: "border-t-indigo-400",
  rose: "border-t-rose-400",
  emerald: "border-t-emerald-400",
  amber: "border-t-amber-400",
  sky: "border-t-sky-400",
  violet: "border-t-violet-400",
  slate: "border-t-stone-300",
};

const ICON_PATHS: Record<string, React.ReactNode> = {
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V9z" />
      <path d="M10 7v10" strokeDasharray="2 3" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2 0 0 1 2.5-1.5c1.5 0 2.5 1 2.5 2s-1 1.5-2.5 2-2.5 1-2.5 2 1 2 2.5 2a2.5 2 0 0 0 2.5-1.5" />
      <path d="M12 6.5v11" />
    </>
  ),
  checkin: (
    <>
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14a5 5 0 0 1 5 6" />
    </>
  ),
  bag: (
    <>
      <path d="M6 8h12l-1 12H7z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11M19 8v11M9 8v11M15 8v11" />
    </>
  ),
  seat: (
    <>
      <path d="M6 10V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" />
      <path d="M4 10h16v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6z" />
      <path d="M6 18v3M18 18v3" />
    </>
  ),
};

export function AdminStatIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      {ICON_PATHS[name] ?? ICON_PATHS.ticket}
    </svg>
  );
}

export function AdminStatCard({
  icon,
  label,
  value,
  sub,
  tone = "indigo",
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  tone?: StatTone;
}) {
  return (
    <div className={`bg-white rounded-xl border border-cream-200 border-t-4 ${TONE_BORDER[tone]} shadow-md p-4 flex items-start gap-3`}>
      <span className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${TONE_BG[tone]}`}>
        <AdminStatIcon name={icon} />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-stone-500">{label}</div>
        <div className="text-xl font-display font-semibold text-stone-800 leading-tight mt-0.5">{value}</div>
        {sub && <div className="text-xs text-stone-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
