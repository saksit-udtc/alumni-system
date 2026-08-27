"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { computeZoomFrame } from "@/lib/floor-plan-zoom";

type Table = {
  id: string;
  tableNumber: number;
  zone: string | null;
  zoneColor: string | null;
  positionX: number | null;
  positionY: number | null;
};

// Computes a reasonable default grid position for a table that has never
// been placed on the floor plan yet, so all tables are visible and
// non-overlapping the first time an admin opens the editor, before
// they've dragged anything.
function defaultPosition(index: number) {
  const perRow = 8;
  const x = 6 + (index % perRow) * (88 / (perRow - 1));
  const y = 8 + Math.floor(index / perRow) * 14;
  return { x: Math.min(94, x), y: Math.min(94, y) };
}

// Pixel distance a pointer has to move before a press counts as a drag
// rather than a click (which toggles selection instead).
const DRAG_THRESHOLD_PX = 4;

// Grid overlay step, in the same 0-100 percent-of-image space as table
// positions — an editor-only visual aid (and optional drag snap target),
// never saved or shown on the public map.
const GRID_STEPS = [1, 2, 3, 5] as const;

type DragState = {
  tableId: string;
  group: string[];
  startClientX: number;
  startClientY: number;
  startImage: { x: number; y: number }; // pointer's starting position in image-percent space
  startPositions: Record<string, { x: number; y: number }>;
  moved: boolean;
};

export default function FloorPlanEditor({
  eventId,
  initialFloorPlanUrl,
  tables,
}: {
  eventId: string;
  initialFloorPlanUrl: string | null;
  tables: Table[];
}) {
  const [floorPlanUrl, setFloorPlanUrl] = useState(initialFloorPlanUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showGrid, setShowGrid] = useState(false);
  const [gridStep, setGridStep] = useState<number>(5);
  // Tracked in real pixels (not percent) so grid cells render as true
  // squares — the canvas itself is a 16:10 rectangle, so using percent for
  // both background-size axes would stretch cells into non-squares.
  const [canvasWidthPx, setCanvasWidthPx] = useState(0);
  // Matched to the uploaded image's real aspect ratio once it loads, so the
  // canvas frame fits the image exactly (no letterboxing) instead of
  // assuming a fixed 16:10 shape that may not match what was uploaded.
  const [imageRatio, setImageRatio] = useState(16 / 10);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const init: Record<string, { x: number; y: number }> = {};
    tables.forEach((t, i) => {
      init[t.id] =
        t.positionX !== null && t.positionY !== null ? { x: t.positionX, y: t.positionY } : defaultPosition(i);
    });
    return init;
  });

  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  // Kept in sync every render so onPointerMove (registered once via
  // useCallback) can read the latest grid settings without stale closures.
  const gridRef = useRef({ enabled: false, step: 5 });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/admin/events/${eventId}/floor-plan`, { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "อัปโหลดไม่สำเร็จ");
      return;
    }
    const data = await res.json();
    setFloorPlanUrl(data.publicUrl || data.floorPlanUrl);
  }

  async function handleRemove() {
    if (!confirm("ลบภาพผังพื้นที่? ผังโต๊ะสาธารณะจะกลับไปแสดงแบบตารางเหมือนเดิม")) return;
    const res = await fetch(`/api/admin/events/${eventId}/floor-plan`, { method: "DELETE" });
    if (res.ok) setFloorPlanUrl(null);
  }

  // Converts a pointer's screen position into the table's true position in
  // the original 0-100 image percent space. The canvas (see render below)
  // always represents the full image 1:1 in percent terms regardless of
  // zoom — zooming just makes it render bigger and scrolls a window onto
  // it — so no zoom-compensation math is needed here, just measure against
  // the canvas's own rect.
  function pointerToImagePercent(clientX: number, clientY: number) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }

  const onPointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !canvasRef.current) return;

    if (!drag.moved) {
      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
    }

    const current = pointerToImagePercent(e.clientX, e.clientY);
    const deltaX = current.x - drag.startImage.x;
    const deltaY = current.y - drag.startImage.y;
    const { enabled: snapEnabled, step } = gridRef.current;
    const snap = (v: number) => (snapEnabled ? Math.round(v / step) * step : v);

    setPositions((prev) => {
      const next = { ...prev };
      for (const id of drag.group) {
        const start = drag.startPositions[id];
        if (!start) continue;
        next[id] = {
          x: Math.max(0, Math.min(100, snap(start.x + deltaX))),
          y: Math.max(0, Math.min(100, snap(start.y + deltaY))),
        };
      }
      return next;
    });
  }, []);

  const onPointerUp = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);

    // A press-and-release without meaningful movement toggles that table's
    // selection instead of moving anything — lets you build up a multi-
    // select by clicking several tables, then drag any one of them to move
    // the whole group together.
    if (drag && !drag.moved) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(drag.tableId)) next.delete(drag.tableId);
        else next.add(drag.tableId);
        return next;
      });
    }
  }, [onPointerMove]);

  function startPointerDown(tableId: string, currentSelection: Set<string>, e: React.PointerEvent) {
    const group = currentSelection.has(tableId) ? Array.from(currentSelection) : [tableId];
    const startPositions: Record<string, { x: number; y: number }> = {};
    for (const id of group) {
      if (positions[id]) startPositions[id] = positions[id];
    }
    dragRef.current = {
      tableId,
      group,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startImage: pointerToImagePercent(e.clientX, e.clientY),
      startPositions,
      moved: false,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  async function saveLayout() {
    setSaving(true);
    setError("");
    setSaved(false);
    const payload = {
      positions: tables
        .map((t) =>
          positions[t.id] ? { tableId: t.id, positionX: positions[t.id].x, positionY: positions[t.id].y } : null
        )
        .filter((p): p is { tableId: string; positionX: number; positionY: number } => p !== null),
    };
    const res = await fetch(`/api/admin/events/${eventId}/tables/positions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "บันทึกไม่สำเร็จ");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const forZoom = tables.map((t) => ({
    zone: t.zone,
    posX: positions[t.id]?.x ?? null,
    posY: positions[t.id]?.y ?? null,
  }));
  const { cx, cy, scale } = computeZoomFrame(forZoom, null);
  const zoomed = scale > 1;
  gridRef.current = { enabled: showGrid, step: gridStep };

  // Measure the image's real aspect ratio via a plain Image() object rather
  // than the rendered <img>'s onLoad — for an already browser-cached image,
  // React's onLoad can fail to fire at all (a well-known quirk), which was
  // leaving one page stuck on the 16:10 fallback while another page that
  // happened to load the image cold got the real ratio, so the same floor
  // plan appeared differently sized/cropped depending which page you'd
  // visited first. new Image().onload fires reliably either way.
  useEffect(() => {
    if (!floorPlanUrl) return;
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) setImageRatio(img.naturalWidth / img.naturalHeight);
    };
    img.src = floorPlanUrl;
  }, [floorPlanUrl]);

  // Scroll the (native, scrollable) viewport so the selected zone's center
  // lands in the middle of view — the canvas itself never moves, we just
  // scroll to a point on it. Declared before the early return below so
  // hook order stays stable whether or not a floor plan is uploaded yet.
  useEffect(() => {
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

  // Track the canvas's rendered pixel width (it resizes with the window and
  // with zoom) so the grid overlay can use a real pixel step for both axes
  // — that's what keeps grid cells true squares instead of being stretched
  // by the canvas's own (non-square) aspect ratio.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = () => setCanvasWidthPx(canvas.offsetWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [scale, floorPlanUrl]);

  if (!floorPlanUrl) {
    return (
      <div className="bg-white border border-cream-200 shadow-md rounded-xl p-6 max-w-md space-y-3">
        <p className="text-sm text-stone-600">
          อัปโหลดภาพผังพื้นที่จัดงาน (เช่น แผนผังบริเวณงาน) แล้วลากวางตำแหน่งโต๊ะแต่ละตัวบนภาพนี้ได้
        </p>
        <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="text-sm" />
        {uploading && <p className="text-xs text-stone-400">กำลังอัปโหลด...</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-600">
          คลิกโต๊ะเพื่อเลือกได้หลายตัว แล้วลากตัวใดตัวหนึ่งเพื่อขยับทั้งกลุ่มพร้อมกัน — ลากโต๊ะที่ไม่ได้เลือกจะขยับตัวนั้นตัวเดียว
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-stone-500">เลือกอยู่ {selectedIds.size} โต๊ะ</span>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-stone-500 underline">
                ล้างการเลือก
              </button>
            </>
          )}
          <button
            onClick={() => setShowGrid((v) => !v)}
            className={`text-xs rounded-md border px-2 py-1 transition-colors ${showGrid ? "bg-maroon-700 text-white border-maroon-700" : "text-stone-600 border-stone-300 hover:bg-cream-50"}`}
          >
            {showGrid ? "ซ่อนตาราง ✓" : "แสดงตาราง"}
          </button>
          {showGrid && (
            <select
              value={gridStep}
              onChange={(e) => setGridStep(Number(e.target.value))}
              className="text-xs rounded-md border border-stone-300 px-1.5 py-1 text-stone-600"
            >
              {GRID_STEPS.map((s) => (
                <option key={s} value={s}>
                  ช่อง {s}%
                </option>
              ))}
            </select>
          )}
          <button
            onClick={saveLayout}
            disabled={saving}
            className="text-sm rounded-md bg-maroon-700 hover:bg-maroon-800 transition-colors text-white px-4 py-1.5 font-medium disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : saved ? "บันทึกแล้ว ✓" : "บันทึกตำแหน่ง"}
          </button>
          <button onClick={handleRemove} className="text-xs text-red-600 hover:text-red-700 underline">
            ลบภาพผัง
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {zoomed && <p className="text-xs text-stone-400">เลื่อนภาพเพื่อดูโต๊ะอื่นในโซนนี้ได้</p>}

      <div
        ref={viewportRef}
        className={`relative border border-cream-200 rounded-xl bg-cream-100 select-none touch-none ${zoomed ? "overflow-auto" : "overflow-hidden"}`}
        style={zoomed ? { maxHeight: "65vh" } : { aspectRatio: `${imageRatio} / 1` }}
      >
        <div ref={canvasRef} className="relative" style={{ width: `${100 * scale}%`, aspectRatio: `${imageRatio} / 1` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={floorPlanUrl}
            alt="ผังพื้นที่งาน"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
          {showGrid && canvasWidthPx > 0 && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(15,23,42,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.35) 1px, transparent 1px)",
                backgroundSize: `${(gridStep / 100) * canvasWidthPx}px ${(gridStep / 100) * canvasWidthPx}px`,
              }}
            />
          )}
          {tables.map((t) => {
            const pos = positions[t.id];
            if (!pos) return null;
            const isSelected = selectedIds.has(t.id);
            return (
              <div
                key={t.id}
                onPointerDown={(e) => {
                  e.preventDefault();
                  startPointerDown(t.id, selectedIds, e);
                }}
                title={t.zone ? `โซน: ${t.zone}` : "ไม่ระบุโซน"}
                // Fixed size per breakpoint (not derived from canvas width):
                // 15px on narrow/Responsive-mode screens, 40px from the sm
                // breakpoint up.
                className="absolute w-[15px] h-[15px] -ml-[7.5px] -mt-[7.5px] sm:w-10 sm:h-10 sm:-ml-5 sm:-mt-5 rounded-full text-white text-[8px] sm:text-sm font-bold flex items-center justify-center cursor-grab active:cursor-grabbing"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  background: t.zoneColor || "#334155",
                  boxShadow: isSelected ? "0 0 0 2px white, 0 0 0 4px #0f172a" : "0 1px 3px rgba(0,0,0,0.4)",
                }}
              >
                {t.tableNumber}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
