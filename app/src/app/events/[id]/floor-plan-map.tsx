"use client";
import { useEffect, useRef, useState } from "react";
import TableGraphic, { type TableRow } from "./table-graphic";
import { zoneColor } from "@/lib/zone-colors";
import { zoneKey, computeZoomFrame } from "@/lib/floor-plan-zoom";

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
  return Math.round(Math.min(150, Math.max(26, canvasWidthPx / 12)));
}

function PlacedTable({
  t,
  eventId,
  eventOpen,
  canvasWidthPx,
  disableBooking,
  onInfoClick,
}: {
  t: TableRow;
  eventId: string;
  eventOpen: boolean;
  canvasWidthPx: number;
  disableBooking: boolean;
  onInfoClick: () => void;
}) {
  const alumniTitle = t.alumniBookers
    .map((a) => `🎓 ${a.department || "ไม่ระบุสาขา"}${a.graduationYear ? ` · จบปี ${a.graduationYear}` : ""}`)
    .join("\n");
  const size = markerSizeForCanvas(canvasWidthPx);

  return (
    <div
      className="absolute"
      style={{ left: `${t.posX}%`, top: `${t.posY}%`, transform: "translate(-50%, -50%)" }}
      title={alumniTitle || undefined}
    >
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

function TableInfoModal({ table, onClose }: { table: TableRow; onClose: () => void }) {
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
        <p className="text-xs text-stone-400 pt-1">เลือกโซนด้านบนก่อนจึงจะจองโต๊ะนี้ได้</p>
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
   * nothing to book from this view. */
  readOnly?: boolean;
}) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [infoTable, setInfoTable] = useState<TableRow | null>(null);
  // Matched to the uploaded image's real aspect ratio once it loads, so the
  // canvas frame fits the image exactly (no letterboxing) instead of
  // assuming a fixed 16:10 shape that may not match what was uploaded.
  const [imageRatio, setImageRatio] = useState(16 / 10);
  // Real rendered pixel width of the canvas, used to size table markers
  // relative to the actual screen — see markerSizeForCanvas above.
  const [canvasWidthPx, setCanvasWidthPx] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const positioned = tables.filter((t) => t.posX !== null && t.posY !== null);
  const unpositioned = tables.filter((t) => t.posX === null || t.posY === null);
  const zoneNames = Array.from(new Set(tables.map((t) => t.zone).filter(Boolean))) as string[];

  const { cx, cy, scale } = computeZoomFrame(positioned, selectedZone);
  const zoomed = scale > 1;
  // When the floor plan has zones, force guests to pick one before they can
  // book — tapping a table before that just shows who's already booked it
  // (see TableInfoModal) instead of jumping straight to the booking form.
  const requireZoneSelection = !readOnly && zoneNames.length > 0 && selectedZone === null;

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
  }, [cx, cy, scale]);

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
  }, [scale, floorPlanUrl]);

  return (
    <div className="space-y-3">
      {zoneNames.length > 0 && (
        <div className="bg-white border border-cream-200 shadow-md rounded-xl px-4 py-4 space-y-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-base text-stone-500 mr-1">
              เลือกโซนเพื่อขยาย{!readOnly && requireZoneSelection && <span className="text-amber-600 font-medium"> *จำเป็นก่อนจอง</span>}:
            </span>
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
          {/* "วิธีจองโต๊ะ" — moved here (line 2 of this same card, under
              the zone selector) in place of the old single-line amber
              warning, so the how-to steps and the zone picker read as one
              unit instead of two separate cards. */}
          {eventOpen && (
            <div className="pt-2.5 border-t border-cream-100">
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { icon: "📍", text: "เลือกโซนที่ต้องการด้านบน" },
                  { icon: "🔍", text: "ดูว่าโต๊ะไหนว่าง/เต็ม และมีศิษย์เก่าคนไหนจองไว้บ้าง" },
                  { icon: "🪑", text: "เลือกโซนก่อนแล้วจึงแตะที่โต๊ะเพื่อเหมาทั้งโต๊ะ" },
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

      <div
        ref={viewportRef}
        className={`relative border border-cream-200 rounded-xl bg-cream-100 ${zoomed ? "overflow-auto" : "overflow-hidden"}`}
        style={zoomed ? { maxHeight: "65vh" } : { aspectRatio: `${imageRatio} / 1` }}
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
              disableBooking={readOnly || requireZoneSelection}
              onInfoClick={() => setInfoTable(t)}
            />
          ))}
        </div>
      </div>
      {zoomed && <p className="text-xs text-stone-400">เลื่อนภาพเพื่อดูโต๊ะอื่นในโซนนี้ได้</p>}

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
                  disableBooking={readOnly || requireZoneSelection}
                  onInfoClick={() => setInfoTable(t)}
                />
                <span className="text-xs text-stone-500 mt-1">โต๊ะ {t.tableNumber}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {infoTable && <TableInfoModal table={infoTable} onClose={() => setInfoTable(null)} />}
    </div>
  );
}
