"use client";
import { useState } from "react";
import TableGraphic, { type TableRow } from "./table-graphic";
import FloorPlanMap from "./floor-plan-map";
import { zoneColor } from "@/lib/zone-colors";

function TableCard({ t, eventId, eventOpen }: { t: TableRow; eventId: string; eventOpen: boolean }) {
  const color = zoneColor(t.zone);
  return (
    <div
      className="rounded-lg border bg-white p-3 flex flex-col items-center gap-1 text-center border-t-4"
      style={{ borderTopColor: color.bg }}
    >
      <TableGraphic table={t} eventId={eventId} eventOpen={eventOpen} />
      <div className="font-semibold">โต๊ะ {t.tableNumber}</div>
      <div className="text-xs text-blue-500">
        {t.isFullTableBooking ? "เหมาแล้ว" : t.seatsRemaining === 0 ? "เต็ม" : `เหลือ ${t.seatsRemaining}/${t.capacity} ที่`}
      </div>
      {t.alumniBookers.length > 0 && (
        <div className="text-xs text-blue-500 border-t pt-1.5 space-y-0.5 w-full">
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
        { icon: "🪑", text: "เลือกโซนก่อนแล้วจึงแตะที่โต๊ะหรือที่นั่งเพื่อจอง" },
      ]
    : [
        { icon: "🔍", text: "ดูว่าโต๊ะไหนว่าง/เต็ม และมีศิษย์เก่าคนไหนจองไว้บ้าง" },
        { icon: "🪑", text: "แตะที่โต๊ะเพื่อเหมาทั้งโต๊ะ หรือแตะที่นั่งเพื่อจองเป็นที่นั่ง" },
        { icon: "🧾", text: "กรอกข้อมูลผู้จองแล้วแนบสลิปโอนเงิน" },
      ];
  return (
    <div className="bg-white border rounded-lg px-4 py-4 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-sky-400 to-blue-500" />
      <button
        onClick={onDismiss}
        aria-label="ปิด"
        className="absolute top-3 right-3 text-blue-300 hover:text-blue-500 text-sm"
      >
        ✕
      </button>
      <p className="text-sm font-semibold text-blue-800 mb-3">วิธีจองโต๊ะ</p>
      <div className="grid sm:grid-cols-3 gap-3 pr-5">
        {steps.map((s, i) => (
          <div key={i} className="relative flex items-start gap-3">
            {i < steps.length - 1 && (
              <span className="hidden sm:block absolute top-4 left-[calc(100%-0.4rem)] w-3 border-t-2 border-dashed border-blue-200" />
            )}
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-sm shrink-0">
              {s.icon}
            </span>
            <div>
              <span className="text-xs font-medium text-blue-600">ขั้นที่ {i + 1}</span>
              <p className="text-sm text-blue-700 leading-snug">{s.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-blue-500 bg-white border rounded-lg px-3 py-2">
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#86efac", border: "1.5px solid #16a34a" }} />
        ที่นั่งว่าง (คลิกเพื่อจองที่นั่ง)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#fca5a5", border: "1.5px solid #dc2626" }} />
        ที่นั่งถูกจองแล้ว
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#0f172a" }} />
        โต๊ะว่างสนิท (คลิกเพื่อเหมาโต๊ะ)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#94a3b8" }} />
        โต๊ะเต็ม/เหมาแล้ว
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
    return (
      <div className="space-y-4">
        {eventOpen && showGuide && <HowToGuide hasZones={zoned} onDismiss={() => setShowGuide(false)} />}
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
    <div className="space-y-4">
      {eventOpen && showGuide && <HowToGuide hasZones={zoned} onDismiss={() => setShowGuide(false)} />}
      <div className="bg-white border rounded-lg px-3 py-3 flex flex-wrap gap-x-6 gap-y-1">
        <div>
          <span className="text-2xl font-bold text-blue-900">{pricePerTable.toLocaleString()}</span>
          <span className="text-sm text-blue-500"> บาท/โต๊ะ (เหมา)</span>
        </div>
        <div>
          <span className="text-2xl font-bold text-blue-900">{pricePerSeat.toLocaleString()}</span>
          <span className="text-sm text-blue-500"> บาท/ที่นั่ง</span>
        </div>
      </div>
      {eventOpen && <Legend />}
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
              <h3 className="text-sm font-semibold text-blue-600 mb-2 flex items-center gap-1.5">
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
