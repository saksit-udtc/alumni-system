"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import TableGraphic, { type TableRow } from "./table-graphic";
import { zoneColor } from "@/lib/zone-colors";
import { zoneKey, computeZoomFrame, computeFocusFrame } from "@/lib/floor-plan-zoom";

// Marker size is derived from the canvas's actual rendered pixel width,
// not a fixed constant — a fixed 75px marker looks fine on a wide desktop
// canvas but badly overlaps neighboring tables on a narrow phone screen,
// where the same floor plan renders at a fraction of the width. Since
// zooming into a zone widens the canvas (see `scale` in the parent), this
// also naturally makes markers bigger when zoomed in, without needing a
// separate scale-based multiplier. Clamped so tables stay tappable on
// tiny screens and don't get comically large on a huge desktop canvas.
function markerSizeForCanvas(canvasWidthPx: number) {
  if (canvasWidthPx <= 0) return 75;
  return Math.round(Math.min(150, Math.max(26, canvasWidthPx / 16)));
}

// Height of the scrollable map window while zoomed (percent of the screen
// height) and the padding kept around a zone when zooming to it — the guest
// flow uses a tighter pad than the admin overview so a zone fills the screen.
const ZOOM_VIEWPORT_VH = 72;
const GUEST_ZOOM_PAD = 4;

const UNASSIGNED_NAME = "ไม่ระบุโซน";

type ZoneStat = { key: string; zone: string | null; name: string; total: number; free: number };

// Booked = same rule TableGraphic uses to paint a table red.
function isTableBooked(t: TableRow) {
  return t.isFullTableBooking || t.seatsReserved > 0;
}

function zoneLabel(z: { zone: string | null }) {
  return z.zone ? `โซน ${z.zone}` : UNASSIGNED_NAME;
}

function buildZoneStats(tables: TableRow[]): ZoneStat[] {
  const map = new Map<string, ZoneStat>();
  for (const t of tables) {
    const key = zoneKey(t.zone);
    let z = map.get(key);
    if (!z) {
      z = { key, zone: t.zone, name: t.zone ?? UNASSIGNED_NAME, total: 0, free: 0 };
      map.set(key, z);
    }
    z.total += 1;
    if (!isTableBooked(t)) z.free += 1;
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.zone === null) return 1;
    if (b.zone === null) return -1;
    return a.name.localeCompare(b.name, "th", { numeric: true });
  });
}

function PlacedTable({
  t,
  eventId,
  eventOpen,
  canvasWidthPx,
  disableBooking,
  highlight,
  dim,
  onInfoClick,
}: {
  t: TableRow;
  eventId: string;
  eventOpen: boolean;
  canvasWidthPx: number;
  disableBooking: boolean;
  highlight: boolean;
  dim: boolean;
  onInfoClick: () => void;
}) {
  const alumniTitle = t.alumniBookers
    .map((a) => `🎓 ${a.department || "ไม่ระบุสาขา"}${a.graduationYear ? ` · จบปี ${a.graduationYear}` : ""}`)
    .join("\n");
  const size = markerSizeForCanvas(canvasWidthPx);

  return (
    <div
      className="absolute"
      style={{ left: `${t.posX}%`, top: `${t.posY}%`, transform: "translate(-50%, -50%)", zIndex: highlight ? 10 : undefined, opacity: dim ? 0.4 : undefined }}
      title={alumniTitle || undefined}
    >
      {highlight && (
        <>
          <span className="pointer-events-none absolute rounded-full border-4 border-maroon-700 animate-ping" style={{ inset: "-4%" }} />
          <span className="pointer-events-none absolute rounded-full border-4 border-maroon-700" style={{ inset: "-4%" }} />
        </>
      )}
      <TableGraphic
        table={t}
        eventId={eventId}
        eventOpen={eventOpen}
        maxWidthPx={size}
        disableBooking={disableBooking}
        onInfoClick={onInfoClick}
      />
    </div>
  );
}

function TableInfoModal({
  table,
  onClose,
  onZoom,
}: {
  table: TableRow;
  onClose: () => void;
  /** Guest flow only: jump + zoom to this table so it can be booked. */
  onZoom?: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-cream-200 shadow-lg p-5 max-w-xs w-full space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-stone-800">โต๊ะ {table.tableNumber}{table.zone ? ` (โซน ${table.zone})` : ""}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-sm">✕</button>
        </div>
        <p className="text-sm text-stone-600">
          {table.isFullTableBooking ? "เหมาแล้ว" : table.seatsRemaining === 0 ? "เต็ม" : `เหลือ ${table.seatsRemaining}/${table.capacity} ที่`}
        </p>
        <div className="border-t border-cream-200 pt-2">
          <p className="text-xs text-stone-500 mb-1">ศิษย์เก่าที่จองโต๊ะนี้</p>
          {table.alumniBookers.length > 0 ? (
            <ul className="text-sm text-stone-700 space-y-1">
              {table.alumniBookers.map((a, i) => (
                <li key={i}>🎓 {a.department || "ไม่ระบุสาขา"}{a.graduationYear ? ` · จบปี ${a.graduationYear}` : ""}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-400">ยังไม่มีศิษย์เก่าจองโต๊ะนี้</p>
          )}
        </div>
        {onZoom && (
          <div className="pt-2 space-y-1">
            <button
              onClick={onZoom}
              className="w-full rounded-lg bg-maroon-700 hover:bg-maroon-800 transition-colors text-white text-sm font-medium py-2"
            >
              ซูมไปที่โต๊ะนี้
            </button>
            <p className="text-xs text-stone-400 text-center">ซูมเข้าไปก่อน แล้วจึงแตะโต๊ะสีเขียวเพื่อจอง</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Small overview of the whole floor plan with every table as a dot in its zone
// colour, so guests can see WHERE each zone sits. `interactive` (zone overview)
// adds a tappable label per zone; otherwise (the thumbnail in the zone bar) the
// selected zone is outlined and the rest greyed out.
function ZoneLocatorMap({
  floorPlanUrl,
  imageRatio,
  onImageRatio,
  tables,
  zoneStats,
  selectedZone,
  interactive,
  onPick,
}: {
  floorPlanUrl: string;
  imageRatio: number;
  onImageRatio: (r: number) => void;
  tables: TableRow[];
  zoneStats: ZoneStat[];
  selectedZone: string | null;
  interactive: boolean;
  onPick?: (key: string) => void;
}) {
  const placed = tables.filter((t) => t.posX !== null && t.posY !== null);
  // Label / outline anchor per zone: the median position of its tables (robust
  // against a stray table far from the rest) and the bounding box.
  const geo = useMemo(() => {
    const byZone = new Map<string, { xs: number[]; ys: number[] }>();
    for (const t of placed) {
      const k = zoneKey(t.zone);
      const g = byZone.get(k) ?? { xs: [], ys: [] };
      g.xs.push(t.posX as number);
      g.ys.push(t.posY as number);
      byZone.set(k, g);
    }
    const med = (a: number[]) => {
      const b = [...a].sort((x, y) => x - y);
      return b[Math.floor(b.length / 2)];
    };
    const out = new Map<string, { cx: number; cy: number; lx: number; ly: number; x0: number; y0: number; x1: number; y1: number }>();
    byZone.forEach((g, k) => {
      const cx = med(g.xs);
      const cy = med(g.ys);
      out.set(k, { cx, cy, lx: cx, ly: cy, x0: Math.min(...g.xs), y0: Math.min(...g.ys), x1: Math.max(...g.xs), y1: Math.max(...g.ys) });
    });
    // Nudge labels apart (downwards) when the chips of neighbouring zones
    // would overlap, e.g. thin single-row zones lying next to each other.
    const placedLabels: { lx: number; ly: number }[] = [];
    Array.from(out.values())
      .sort((a, b) => a.cy - b.cy || a.cx - b.cx)
      .forEach((g) => {
        for (let i = 0; i < 4; i++) {
          if (!placedLabels.some((o) => Math.abs(o.lx - g.lx) < 17 && Math.abs(o.ly - g.ly) < 5)) break;
          g.ly += 5;
        }
        placedLabels.push(g);
      });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables]);

  const dot = interactive ? "1.5%" : "2.6%";
  const sel = selectedZone !== null ? geo.get(selectedZone) : null;

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-cream-200 bg-cream-100" style={{ aspectRatio: String(imageRatio) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={floorPlanUrl}
        alt="ผังงาน"
        onLoad={(e) => {
          const im = e.currentTarget;
          if (im.naturalWidth > 0 && im.naturalHeight > 0) onImageRatio(im.naturalWidth / im.naturalHeight);
        }}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      />
      {placed.map((t) => {
        const k = zoneKey(t.zone);
        const on = interactive || selectedZone === null || k === selectedZone;
        return (
          <span
            key={t.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${t.posX}%`,
              top: `${t.posY}%`,
              width: dot,
              aspectRatio: "1",
              transform: "translate(-50%, -50%)",
              background: on ? zoneColor(t.zone).bg : "#a8a29e",
              opacity: on ? 0.95 : 0.45,
            }}
          />
        );
      })}
      {!interactive && sel && selectedZone !== null && (
        <span
          className="absolute rounded-md border-2 pointer-events-none"
          style={{
            left: `${sel.x0 - 3}%`,
            top: `${sel.y0 - 3}%`,
            width: `${sel.x1 - sel.x0 + 6}%`,
            height: `${sel.y1 - sel.y0 + 6}%`,
            borderColor: zoneColor(zoneStats.find((z) => z.key === selectedZone)?.zone ?? null).bg,
          }}
        />
      )}
      {interactive &&
        zoneStats.map((z) => {
          const g = geo.get(z.key);
          if (!g) return null;
          const full = z.free === 0;
          return (
            <button
              key={z.key}
              type="button"
              onClick={() => onPick?.(z.key)}
              aria-label={`${zoneLabel(z)} เหลือ ${z.free} จาก ${z.total} โต๊ะ`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md px-2 py-0.5 text-xs font-semibold text-white leading-tight whitespace-nowrap active:scale-95 transition"
              style={{ left: `${g.lx}%`, top: `${g.ly}%`, background: zoneColor(z.zone).bg, opacity: full ? 0.6 : 1 }}
            >
              {z.name}
              <span className="font-normal opacity-90"> · {full ? "เต็ม" : z.free}</span>
            </button>
          );
        })}
    </div>
  );
}

// Bottom sheet opened by the floating "ดูโซนอื่น" button: switch zone in one
// tap (with each zone's vacancy) without going back to the zone overview.
function ZoneSwitcherSheet({
  zones,
  currentKey,
  onPick,
  onShowAll,
  onClose,
}: {
  zones: ZoneStat[];
  currentKey: string | null;
  onPick: (key: string) => void;
  onShowAll: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label="เลือกโซน"
        className="w-full sm:max-w-sm max-h-[75vh] overflow-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-lg p-4 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-stone-800">เลือกโซน</h3>
          <button onClick={onClose} aria-label="ปิด" className="text-stone-400 hover:text-stone-600 text-sm px-2">✕</button>
        </div>
        <div className="space-y-1.5">
          {zones.map((z) => {
            const active = z.key === currentKey;
            return (
              <button
                key={z.key}
                onClick={() => onPick(z.key)}
                className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${active ? "border-maroon-700 bg-primary-50" : "border-stone-200 hover:bg-cream-50"}`}
              >
                <span className="inline-block w-3.5 h-3.5 rounded-full shrink-0" style={{ background: zoneColor(z.zone).bg }} />
                <span className="flex-1 font-medium text-stone-800">{zoneLabel(z)}</span>
                <span className={`text-sm ${z.free === 0 ? "text-red-600" : "text-stone-600"}`}>
                  {z.free === 0 ? "เต็มแล้ว" : `เหลือ ${z.free}/${z.total}`}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onShowAll}
          className="w-full rounded-lg border border-stone-300 text-stone-600 hover:bg-cream-50 transition-colors text-sm py-2.5"
        >
          ดูทั้งหมดบนผัง
        </button>
      </div>
    </div>
  );
}

export default function FloorPlanMap({
  floorPlanUrl,
  tables,
  eventId,
  eventOpen,
  pricePerTable,
  pricePerSeat,
  readOnly = false,
}: {
  floorPlanUrl: string;
  tables: TableRow[];
  eventId: string;
  eventOpen: boolean;
  pricePerTable: number;
  pricePerSeat: number;
  /** Admin overview mode: tables are never bookable regardless of zone
   * selection — clicking always shows the info modal, and the booking-flow
   * instruction copy ("เลือกโซนก่อนจึงจะจองได้") is hidden since there's
   * nothing to book from this view. The admin overview keeps the original
   * zone-pill selector; the zone-first guest flow below is guest-only. */
  readOnly?: boolean;
}) {
  // selectedZone: a zoneKey, or null when no single zone is selected.
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  // "ดูทั้งหมด": the whole plan at once (opt-in; the guest default is the zone overview).
  const [showAll, setShowAll] = useState(false);
  // Table jumped to via search / the info modal — zoomed to and highlighted.
  const [focusTableId, setFocusTableId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [searchMsg, setSearchMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [scrollTick, setScrollTick] = useState(0);
  const [infoTable, setInfoTable] = useState<TableRow | null>(null);
  // Matched to the uploaded image's real aspect ratio once it loads, so the
  // canvas frame fits the image exactly (no letterboxing) instead of
  // assuming a fixed 16:10 shape that may not match what was uploaded.
  const [imageRatio, setImageRatio] = useState(16 / 10);
  // Real rendered pixel width of the canvas, used to size table markers
  // relative to the actual screen — see markerSizeForCanvas above.
  const [canvasWidthPx, setCanvasWidthPx] = useState(0);
  // Real size of the visible map window, so zoom-to-fit can fit a zone on
  // this particular screen (see computeZoomFrame's `viewport` option).
  const [vp, setVp] = useState({ width: 0, height: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);

  const positioned = tables.filter((t) => t.posX !== null && t.posY !== null);
  const unpositioned = tables.filter((t) => t.posX === null || t.posY === null);
  const zoneNames = Array.from(new Set(tables.map((t) => t.zone).filter(Boolean))) as string[];
  const hasZones = zoneNames.length > 0;
  const zoneStats = useMemo(() => buildZoneStats(tables), [tables]);
  const guest = !readOnly;

  // Zone overview = the guest's first step when the plan has zones: big zone
  // cards with vacancy, no individual tables yet.
  const inZonesOverview = guest && hasZones && selectedZone === null && !showAll && focusTableId === null;
  const mapVisible = !inZonesOverview;

  const focusTable = focusTableId ? positioned.find((t) => t.id === focusTableId) ?? null : null;
  const { cx, cy, scale } = focusTable
    ? computeFocusFrame(focusTable, vp.width)
    : computeZoomFrame(
        positioned,
        selectedZone,
        guest
          ? {
              pad: GUEST_ZOOM_PAD,
              viewport: vp.width > 0 ? { width: vp.width, height: vp.height, imageRatio } : undefined,
            }
          : {}
      );
  const zoomed = scale > 1;
  // With zones, tables can only be booked once zoomed into a zone (or jumped
  // to) — in the "ดูทั้งหมด" view a tap just shows the table's info, so a
  // fat-finger on tiny markers can't start a booking on the wrong table.
  const disableBooking = readOnly || (hasZones && selectedZone === null);
  const requireZoneSelection = !readOnly && hasZones && selectedZone === null;

  const currentStat = selectedZone !== null ? zoneStats.find((z) => z.key === selectedZone) ?? null : null;

  // Measure the image's real aspect ratio via a plain Image() object rather
  // than the rendered <img>'s onLoad — for an already browser-cached image,
  // React's onLoad can fail to fire at all (a well-known quirk), which was
  // leaving this page stuck on the 16:10 fallback while another page that
  // happened to load the image cold got the real ratio, so the same floor
  // plan appeared differently sized/cropped depending which page you'd
  // visited first. new Image().onload fires reliably either way.
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) setImageRatio(img.naturalWidth / img.naturalHeight);
    };
    img.src = floorPlanUrl;
  }, [floorPlanUrl]);

  // Scroll the (native, scrollable) viewport so the selected zone's center
  // lands in the middle of view — the canvas itself never moves, we just
  // scroll to a point on it.
  useEffect(() => {
    // Wait a frame so the canvas's new width (it no longer transitions, but
    // give layout a tick regardless) is reflected in offsetWidth before we
    // measure it — reading it in the same tick as the state update that
    // resizes it was returning the stale pre-resize size and scrolling to
    // the wrong spot.
    const raf = requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      const canvas = canvasRef.current;
      if (!viewport || !canvas) return;
      const targetLeft = (canvas.offsetWidth * cx) / 100 - viewport.clientWidth / 2;
      const targetTop = (canvas.offsetHeight * cy) / 100 - viewport.clientHeight / 2;
      viewport.scrollTo({
        left: Math.max(0, Math.min(targetLeft, canvas.offsetWidth - viewport.clientWidth)),
        top: Math.max(0, Math.min(targetTop, canvas.offsetHeight - viewport.clientHeight)),
        behavior: "smooth",
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [cx, cy, scale, mapVisible]);

  // Track the canvas's rendered pixel width (changes with window size and
  // with zoom, since zoom widens the canvas) so marker sizing can react to
  // the real screen, not just an assumed desktop width.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = () => setCanvasWidthPx(canvas.offsetWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [scale, floorPlanUrl, mapVisible]);

  // Track the visible map window (width follows the layout, height is the
  // zoomed window's cap) for zoom-to-fit.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      const height = Math.round((window.innerHeight * ZOOM_VIEWPORT_VH) / 100);
      setVp((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [mapVisible]);

  // After picking a zone / jumping to a table, bring the map to the top of
  // the screen so the zoomed view fills it (the zone cards / search box that
  // triggered this can be well above the fold on a phone).
  useEffect(() => {
    if (scrollTick === 0) return;
    const raf = requestAnimationFrame(() => {
      mapWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [scrollTick]);

  function goOverview() {
    setSelectedZone(null);
    setShowAll(false);
    setFocusTableId(null);
    setSwitcherOpen(false);
  }

  function goAll() {
    setSelectedZone(null);
    setShowAll(true);
    setFocusTableId(null);
    setSwitcherOpen(false);
  }

  function pickZone(key: string) {
    setSelectedZone(key);
    setShowAll(false);
    setFocusTableId(null);
    setSwitcherOpen(false);
    setSearchMsg(null);
    setScrollTick((n) => n + 1);
  }

  // Jump straight to a table: select its zone (so "ดูโซนอื่น" etc. still make
  // sense), zoom onto the table itself and highlight it.
  function jumpToTable(t: TableRow) {
    setInfoTable(null);
    if (t.posX === null || t.posY === null) {
      setInfoTable(t);
      return;
    }
    setShowAll(false);
    setSelectedZone(zoneKey(t.zone));
    setFocusTableId(t.id);
    setSwitcherOpen(false);
    setScrollTick((n) => n + 1);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const raw = searchText.trim();
    if (!raw) {
      setSearchMsg({ kind: "error", text: "กรุณาพิมพ์เลขโต๊ะ" });
      return;
    }
    if (!/^\d+$/.test(raw)) {
      setSearchMsg({ kind: "error", text: "กรุณาพิมพ์เลขโต๊ะเป็นตัวเลขเท่านั้น" });
      return;
    }
    const num = Number(raw);
    const found = tables.find((t) => t.tableNumber === num);
    if (!found) {
      setSearchMsg({ kind: "error", text: `ไม่พบโต๊ะเลข ${num}` });
      return;
    }
    const status = isTableBooked(found) ? "จองแล้ว" : "ว่าง";
    if (found.posX === null || found.posY === null) {
      setSearchMsg({ kind: "info", text: `โต๊ะ ${num}${found.zone ? ` · โซน ${found.zone}` : ""} · ${status} (ยังไม่ได้จัดตำแหน่งบนผัง)` });
    } else {
      setSearchMsg({ kind: "info", text: `โต๊ะ ${num}${found.zone ? ` · โซน ${found.zone}` : ""} · ${status}` });
    }
    jumpToTable(found);
  }

  const topLevelIsAll = selectedZone === null && showAll && focusTableId === null;

  return (
    <div className="space-y-3">
      {/* Admin overview (readOnly): the original zone pill selector, unchanged. */}
      {readOnly && hasZones && (
        <div className="bg-white border border-cream-200 shadow-md rounded-xl px-4 py-4 space-y-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-base text-stone-500 mr-1">เลือกโซนเพื่อขยาย:</span>
            <button
              onClick={() => setSelectedZone(null)}
              className={`text-base px-4 py-2 rounded-full border transition-colors ${selectedZone === null ? "bg-maroon-700 text-white border-maroon-700" : "border-stone-300 text-stone-600 hover:bg-cream-50"}`}
            >
              ทั้งหมด
            </button>
            {zoneNames.map((z) => (
              <button
                key={z}
                onClick={() => setSelectedZone(zoneKey(z))}
                className={`text-base px-4 py-2 rounded-full border flex items-center gap-2 transition-colors ${selectedZone === zoneKey(z) ? "text-white border-transparent" : "border-stone-300 text-stone-600 hover:bg-cream-50"}`}
                style={selectedZone === zoneKey(z) ? { background: zoneColor(z).bg } : undefined}
              >
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: zoneColor(z).bg }} />
                {z}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Guest header: table-number search (a shortcut alongside the zones),
          the zone / all-tables switch, and the how-to steps. */}
      {guest && (
        <div className="bg-white border border-cream-200 shadow-md rounded-xl px-4 py-4 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                if (searchMsg) setSearchMsg(null);
              }}
              placeholder="ค้นหาเลขโต๊ะ เช่น 42"
              aria-label="ค้นหาเลขโต๊ะ"
              className="min-w-0 flex-1 border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-maroon-700 hover:bg-maroon-800 transition-colors text-white font-medium px-4 py-2"
            >
              ไปที่โต๊ะ
            </button>
          </form>
          {searchMsg && (
            <p className={`text-sm ${searchMsg.kind === "error" ? "text-red-600" : "text-emerald-700"}`} role={searchMsg.kind === "error" ? "alert" : "status"}>
              {searchMsg.text}
            </p>
          )}

          {hasZones && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-stone-500 mr-1">มุมมอง:</span>
              <button
                onClick={goOverview}
                className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${!topLevelIsAll ? "bg-maroon-700 text-white border-maroon-700" : "border-stone-300 text-stone-600 hover:bg-cream-50"}`}
              >
                แบ่งตามโซน
              </button>
              <button
                onClick={goAll}
                className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${topLevelIsAll ? "bg-maroon-700 text-white border-maroon-700" : "border-stone-300 text-stone-600 hover:bg-cream-50"}`}
              >
                ดูทั้งหมด
              </button>
            </div>
          )}

          {eventOpen && hasZones && inZonesOverview && (
            <div className="pt-2.5 border-t border-cream-100">
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { icon: "📍", text: "แตะโซนที่ต้องการ (หรือพิมพ์เลขโต๊ะด้านบน)" },
                  { icon: "🔍", text: "ผังจะซูมเข้าโซนนั้น ดูว่าโต๊ะไหนว่าง/เต็ม และมีศิษย์เก่าคนไหนจองไว้บ้าง" },
                  { icon: "🪑", text: "แตะโต๊ะสีเขียวเพื่อเหมาทั้งโต๊ะ" },
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-50 border border-primary-200 text-sm shrink-0">
                      {s.icon}
                    </span>
                    <p className="text-sm text-stone-600 leading-snug">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Zone overview: one big card per zone with its vacancy. */}
      {inZonesOverview && positioned.length > 0 && (
        <div className="bg-white border border-cream-200 shadow-md rounded-xl p-3 space-y-2">
          <p className="text-sm text-stone-600">
            <span className="font-medium text-stone-700">ตำแหน่งแต่ละโซนบนผัง</span> — แตะชื่อโซนบนแผนที่ หรือเลือกจากการ์ดด้านล่าง
          </p>
          <ZoneLocatorMap
            floorPlanUrl={floorPlanUrl}
            imageRatio={imageRatio}
            onImageRatio={setImageRatio}
            tables={tables}
            zoneStats={zoneStats}
            selectedZone={null}
            interactive
            onPick={pickZone}
          />
        </div>
      )}

      {inZonesOverview && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {zoneStats.map((z) => {
            const color = zoneColor(z.zone);
            const full = z.free === 0;
            const bookedPct = z.total > 0 ? Math.round(((z.total - z.free) / z.total) * 100) : 0;
            return (
              <button
                key={z.key}
                onClick={() => pickZone(z.key)}
                className={`text-left rounded-xl border border-cream-200 shadow-md bg-white p-4 border-t-8 transition hover:shadow-lg active:scale-[0.98] ${full ? "opacity-70" : ""}`}
                style={{ borderTopColor: color.bg }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xl font-display font-semibold text-stone-800">{zoneLabel(z)}</span>
                  {full && <span className="text-xs rounded-full bg-red-50 text-red-600 border border-red-200 px-2 py-0.5">เต็มแล้ว</span>}
                </div>
                <p className="mt-1 text-base text-stone-700">
                  {full ? `จองครบ ${z.total} โต๊ะ` : <>เหลือ <span className="font-semibold text-emerald-700">{z.free}</span>/{z.total} โต๊ะ</>}
                </p>
                <div className="mt-2 h-2 rounded-full bg-stone-200 overflow-hidden" aria-hidden="true">
                  <div className="h-full rounded-full" style={{ width: `${bookedPct}%`, background: color.bg }} />
                </div>
                <p className="mt-2 text-xs text-stone-400">แตะเพื่อดูโต๊ะในโซนนี้ ›</p>
              </button>
            );
          })}
        </div>
      )}

      {mapVisible && (
        <div ref={mapWrapRef} className="space-y-3 scroll-mt-16">
          {/* Zone bar above the zoomed map: which zone, its vacancy, way back. */}
          {guest && selectedZone !== null && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-white border border-cream-200 shadow-md rounded-xl px-4 py-2.5">
              {hasZones && currentStat && (
                <div className="w-24 shrink-0" title="ตำแหน่งโซนนี้บนผัง">
                  <ZoneLocatorMap
                    floorPlanUrl={floorPlanUrl}
                    imageRatio={imageRatio}
                    onImageRatio={setImageRatio}
                    tables={tables}
                    zoneStats={zoneStats}
                    selectedZone={selectedZone}
                    interactive={false}
                  />
                </div>
              )}
              {hasZones && currentStat ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 rounded-full shrink-0" style={{ background: zoneColor(currentStat.zone).bg }} />
                  <span className="font-display font-semibold text-stone-800">{zoneLabel(currentStat)}</span>
                  <span className="text-sm text-stone-600">— เหลือ {currentStat.free}/{currentStat.total} โต๊ะ</span>
                </>
              ) : (
                <span className="font-display font-semibold text-stone-800">ผังโต๊ะทั้งหมด</span>
              )}
              {focusTable && (
                <button
                  onClick={() => setFocusTableId(null)}
                  className="text-xs rounded-full border border-maroon-700 text-maroon-700 px-2.5 py-0.5 hover:bg-primary-50"
                >
                  โต๊ะ {focusTable.tableNumber} ✕
                </button>
              )}
              <button onClick={goOverview} className="ml-auto text-sm text-maroon-700 hover:text-maroon-800 hover:underline">
                {hasZones ? "← ภาพรวมโซน" : "← ดูทั้งหมด"}
              </button>
            </div>
          )}

          <div
            ref={viewportRef}
            className={`relative border border-cream-200 rounded-xl bg-cream-100 ${zoomed ? "overflow-auto" : "overflow-hidden"}`}
            style={zoomed ? { maxHeight: `${ZOOM_VIEWPORT_VH}vh` } : { aspectRatio: `${imageRatio} / 1` }}
          >
            <div
              ref={canvasRef}
              className="relative"
              style={{ width: `${100 * scale}%`, aspectRatio: `${imageRatio} / 1` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={floorPlanUrl}
                alt="ผังพื้นที่งาน"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />
              {positioned.map((t) => (
                <PlacedTable
                  key={t.id}
                  t={t}
                  eventId={eventId}
                  eventOpen={eventOpen}
                  canvasWidthPx={canvasWidthPx}
                  disableBooking={disableBooking}
                  highlight={t.id === focusTableId}
                  dim={guest && selectedZone !== null && !showAll && zoneKey(t.zone) !== selectedZone}
                  onInfoClick={() => setInfoTable(t)}
                />
              ))}
            </div>
          </div>
          {zoomed && <p className="text-xs text-stone-400">เลื่อนภาพเพื่อดูโต๊ะอื่นในโซนนี้ได้</p>}
          {guest && hasZones && selectedZone === null && showAll && requireZoneSelection && eventOpen && (
            <p className="text-xs text-amber-700">
              มุมมองนี้ใช้ดูภาพรวมเท่านั้น — แตะโต๊ะเพื่อดูข้อมูล หรือเลือกโซน/ค้นหาเลขโต๊ะเพื่อซูมเข้าไปจอง
            </p>
          )}

          {unpositioned.length > 0 && (
            <div>
              <p className="text-xs text-stone-400 mb-2">โต๊ะที่ยังไม่ได้จัดตำแหน่งบนผัง</p>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                {unpositioned.map((t) => (
                  <div key={t.id} className="rounded-lg border border-cream-200 bg-white p-2 flex flex-col items-center">
                    <TableGraphic
                      table={t}
                      eventId={eventId}
                      eventOpen={eventOpen}
                      maxWidthPx={96}
                      disableBooking={disableBooking}
                      onInfoClick={() => setInfoTable(t)}
                    />
                    <span className="text-xs text-stone-500 mt-1">โต๊ะ {t.tableNumber}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating "ดูโซนอื่น": always reachable while zoomed into a zone. */}
      {guest && hasZones && selectedZone !== null && (
        <button
          onClick={() => setSwitcherOpen(true)}
          className="fixed bottom-4 left-4 md:left-auto md:right-4 z-40 rounded-full bg-maroon-700 hover:bg-maroon-800 active:scale-95 transition text-white text-sm font-semibold shadow-lg px-4 py-2.5"
        >
          🗺 ดูโซนอื่น
        </button>
      )}
      {switcherOpen && (
        <ZoneSwitcherSheet
          zones={zoneStats}
          currentKey={selectedZone}
          onPick={pickZone}
          onShowAll={goAll}
          onClose={() => setSwitcherOpen(false)}
        />
      )}

      {infoTable && (
        <TableInfoModal
          table={infoTable}
          onClose={() => setInfoTable(null)}
          onZoom={guest && infoTable.posX !== null && infoTable.posY !== null ? () => jumpToTable(infoTable) : undefined}
        />
      )}
    </div>
  );
}
