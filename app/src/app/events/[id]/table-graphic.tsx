"use client";
import { useRouter } from "next/navigation";
import { zoneColor } from "@/lib/zone-colors";

type AlumniInfo = { department: string | null; graduationYear: string | null };

// Field names match this scaffold's Prisma `Table` model (positionX/positionY,
// not the old Supabase app's pos_x/pos_y), but `floor-plan-zoom.ts`'s
// `computeZoomFrame` expects a `PosTable` shape with `posX`/`posY` — callers
// build this TableRow with posX/posY aliased from positionX/positionY so the
// already-ported zoom math needs no changes.
export type TableRow = {
  id: string;
  tableNumber: number;
  zone: string | null;
  capacity: number;
  seatsReserved: number;
  seatsRemaining: number;
  isFullTableBooking: boolean;
  alumniBookers: AlumniInfo[];
  posX: number | null;
  posY: number | null;
};

// Draws one table as an SVG: a round table in the center with `capacity`
// chairs arranged around it. Chairs are purely symbolic (the data model
// tracks a seat *count* per table, not individually-assigned seats), so
// the first `seatsReserved` chairs are colored "booked" and the rest
// "available" — which chair is which doesn't correspond to a specific
// person. Clicking the table books the whole table; clicking an available
// chair goes to the seats-booking form (asks how many seats, defaulting
// to 1). Both are just alternate entry points into the same two flows the
// old buttons offered.
export default function TableGraphic({
  table,
  eventId,
  eventOpen,
  maxWidthPx = 180,
  chairDistance = 70,
  tableColor = "status",
  disableBooking = false,
  onInfoClick,
}: {
  table: TableRow;
  eventId: string;
  eventOpen: boolean;
  maxWidthPx?: number;
  /** distance of chairs from table center, in the 200x200 viewBox */
  chairDistance?: number;
  /** "status" = dark/gray by booking state (grid view); "zone" = colored by zone, dimmed when full (floor plan view) */
  tableColor?: "status" | "zone";
  /** When true, clicking the table never navigates to booking — used before
   * a zone is selected on the floor plan, so guests browse tables (and see
   * who's booked there) before committing to a zone. */
  disableBooking?: boolean;
  onInfoClick?: () => void;
}) {
  const router = useRouter();
  const size = 200;
  const center = size / 2;
  const tableRadius = 36;
  const chairRadius = 11;

  const canBookFullTable = !disableBooking && eventOpen && table.seatsReserved === 0 && !table.isFullTableBooking;
  const canBookSeats = !disableBooking && eventOpen && !table.isFullTableBooking && table.seatsRemaining > 0;
  const isFull = table.isFullTableBooking || table.seatsRemaining === 0;

  const chairs = Array.from({ length: table.capacity }, (_, i) => {
    const angle = (i / table.capacity) * 2 * Math.PI - Math.PI / 2;
    const x = center + chairDistance * Math.cos(angle);
    const y = center + chairDistance * Math.sin(angle);
    const booked = table.isFullTableBooking || i < table.seatsReserved;
    return { x, y, booked };
  });

  function goToFullTable() {
    if (disableBooking) return onInfoClick?.();
    if (!canBookFullTable) return;
    router.push(`/events/${eventId}/reserve/${table.id}?type=full_table`);
  }
  function goToSeats() {
    if (disableBooking) return onInfoClick?.();
    if (!canBookSeats) return;
    router.push(`/events/${eventId}/reserve/${table.id}?type=seats`);
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full mx-auto select-none" style={{ maxWidth: maxWidthPx }}>
      {chairs.map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={chairRadius}
          fill={c.booked ? "#fca5a5" : "#86efac"}
          stroke={c.booked ? "#dc2626" : "#16a34a"}
          strokeWidth={1.5}
          className={disableBooking || (!c.booked && canBookSeats) ? "cursor-pointer" : ""}
          onClick={disableBooking ? goToSeats : !c.booked ? goToSeats : undefined}
        >
          <title>{disableBooking ? "คลิกเพื่อดูข้อมูลโต๊ะ" : c.booked ? "จองแล้ว" : canBookSeats ? "คลิกเพื่อจองที่นั่ง" : "ที่นั่งว่าง"}</title>
        </circle>
      ))}
      <circle
        cx={center}
        cy={center}
        r={tableRadius}
        fill={tableColor === "zone" ? zoneColor(table.zone).bg : isFull ? "#94a3b8" : canBookFullTable ? "#0f172a" : "#334155"}
        fillOpacity={tableColor === "zone" && isFull ? 0.45 : 1}
        stroke="#1e293b"
        strokeWidth={1.5}
        className={disableBooking || canBookFullTable ? "cursor-pointer" : ""}
        onClick={goToFullTable}
      >
        <title>{disableBooking ? "คลิกเพื่อดูข้อมูลโต๊ะ" : canBookFullTable ? "คลิกเพื่อเหมาโต๊ะ" : isFull ? "เต็ม" : "มีคนจองแล้วบางส่วน"}</title>
      </circle>
      <text
        x={center}
        y={center}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="16"
        fontWeight="700"
        fill="white"
        className={disableBooking || canBookFullTable ? "cursor-pointer" : "pointer-events-none"}
        onClick={goToFullTable}
      >
        {table.tableNumber}
      </text>
    </svg>
  );
}
