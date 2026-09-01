"use client";
import { useState } from "react";
import TableGraphic, { type TableRow } from "./table-graphic";
import FloorPlanMap from "./floor-plan-map";
import { zoneColor } from "@/lib/zone-colors";

function TableCard({ t, eventId, eventOpen }: { t: TableRow; eventId: string; eventOpen: boolean }) {
  const color = zoneColor(t.zone);
  return (
    <div
      className="rounded-lg border border-cream-200 shadow-md bg-white p-3 flex flex-col items-center gap-1 text-center border-t-4"
      style={{ borderTopColor: color.bg }}
    >
      <TableGraphic table={t} eventId={eventId} eventOpen={eventOpen} />
      <div className="font-semibold">โต๊ะ {t.tableNumber}</div>
      <div className="text-xs text-primary-500">
        {t.isFullTableBooking ? "เหมาแล้ว" : t.seatsRemaining === 0 ? "เต็ม" : `เหลือ ${t.seatsRemaining}/${t.capacity} ที่`}
      </div>
      {t.alumniBookers.length > 0 && (
        <div className="text-xs text-primary-500 border-t border-cream-200 pt-1.5 space-y-0.5 w-full">
          {t.alumniBookers.map((a, i) => (
            <div key={i}>
              🎓 {a.department || "ไม่ระบุสาขา"}{a.graduationYear ? ` · จบปี ${a.graduationYear}` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HowToGuide({ hasZones, onDismiss }: { hasZones: boolean; onDismiss: () => void }) {
  const steps = hasZones
    ? [
        { icon: "📍", text: "เลือกโซนที่ต้องการด้านบน" },
        { icon: "🔍", text: "ดูว่าโต๊ะไหนว่าง/เต็ม และมีศิษย์เก่าคนไหนจองไว้บ้าง" },
        { icon: "🪑", text: "เลือกโซนก่อนแล้วจึงแตะที่โต๊ะเพื่อเหมาทั้งโต๊ะ" },
      ]
    : [
        { icon: "🔍", text: "ดูว่าโต๊ะไหนว่าง/เต็ม และมีศิษย์เก่าคนไหนจองไว้บ้าง" },
        { icon: "🪑", text: "แตะที่โต๊ะเพื่อเหมาทั้งโต๊ะ" },
        { icon: "🧾", text: "กรอกข้อมูลผู้จองแล้วแนบสลิปโอนเงิน" },
      ];
  return (
    <div className="bg-white border border-cream-200 shadow-md rounded-xl px-4 py-4 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary-500" />
      <button
        onClick={onDismiss}
        aria-label="ปิด"
        className="absolute top-3 right-3 text-primary-300 hover:text-primary-500 text-sm"
      >
        ✕
      </button>
      <p className="text-sm font-semibold text-primary-800 mb-3">วิธีจองโต๊ะ</p>
      <div className="grid sm:grid-cols-3 gap-3 pr-5">
        {steps.map((s, i) => (
          <div key={i} className="relative flex items-start gap-3">
            {i < steps.length - 1 && (
              <span className="hidden sm:block absolute top-4 left-[calc(100%-0.4rem)] w-3 border-t-2 border-dashed border-primary-200" />
            )}
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-50 border border-primary-200 text-sm shrink-0">
              {s.icon}
            </span>
            <div>
              <span className="text-xs font-medium text-primary-600">ขั้นที่ {i + 1}</span>
              <p className="text-sm text-primary-700 leading-snug">{s.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-primary-500 bg-white border border-cream-200 shadow-md rounded-lg px-3 py-2">
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#22c55e", border: "1.5px solid #16a34a" }} />
        โต๊ะว่าง (คลิกเพื่อเหมาโต๊ะ)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#ef4444", border: "1.5px solid #dc2626" }} />
        โต๊ะจองแล้ว
      </span>
    </div>
  );
}

// Unlike the old Supabase app's TableMap (which self-fetched
// `/api/events/[id]/tables` on a 15s interval), this scaffold has no
// standalone tables endpoint — the parent event page already fetches and
// polls `/api/events/[id]` (tables + stats in one payload) per this
// scaffold's established data-fetching convention, so `tables` arrives as a
// prop here instead of being fetched again.
export default function TableMap({
  eventId,
  eventOpen,
  floorPlanUrl,
  tables,
  pricePerTable,
  pricePerSeat,
}: {
  eventId: string;
  eventOpen: boolean;
  floorPlanUrl: string | null;
  tables: TableRow[];
  pricePerTable: number;
  pricePerSeat: number;
}) {
  const [showGuide, setShowGuide] = useState(true);

  const zoned = tables.some((t) => t.zone);

  if (floorPlanUrl) {
    // "วิธีจองโต๊ะ" now renders inside FloorPlanMap's own zone-selector
    // card (line 2, replacing the old single-line warning) instead of as
    // a separate card here.
    return (
      <div className="space-y-3">
        <FloorPlanMap
          floorPlanUrl={floorPlanUrl}
          tables={tables}
          eventId={eventId}
          eventOpen={eventOpen}
          pricePerTable={pricePerTable}
          pricePerSeat={pricePerSeat}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {eventOpen && showGuide && <HowToGuide hasZones={zoned} onDismiss={() => setShowGuide(false)} />}
      {/* Price + status legend now live in the parent page's header
          (line 2, right under event name/date/location) — not duplicated
          here anymore. */}
      {!zoned ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tables.map((t) => (
            <TableCard key={t.id} t={t} eventId={eventId} eventOpen={eventOpen} />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(new Set(tables.map((t) => t.zone ?? "ไม่ระบุโซน"))).map((zone) => (
            <div key={zone}>
              <h3 className="text-sm font-semibold text-primary-600 mb-2 flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: zoneColor(zone === "ไม่ระบุโซน" ? null : zone).bg }} />
                โซน: {zone}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {tables
                  .filter((t) => (t.zone ?? "ไม่ระบุโซน") === zone)
                  .map((t) => (
                    <TableCard key={t.id} t={t} eventId={eventId} eventOpen={eventOpen} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
