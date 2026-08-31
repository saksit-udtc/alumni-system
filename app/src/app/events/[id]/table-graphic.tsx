"use client";
import { useRouter } from "next/navigation";

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

// Draws one table as a single plain circle — seat-level booking is
// disabled system-wide (guests may only book a whole table), so there is
// no per-seat chair ring to render any more. The circle is green when the
// table is open for booking and red once someone has booked it (whole
// table, since that is the only booking type left); clicking a green
// (open) table books it.
export default function TableGraphic({
  table,
  eventId,
  eventOpen,
  maxWidthPx = 180,
  disableBooking = false,
  onInfoClick,
}: {
  table: TableRow;
  eventId: string;
  eventOpen: boolean;
  maxWidthPx?: number;
  /** When true, clicking the table never navigates to booking — used before
   * a zone is selected on the floor plan, so guests browse tables (and see
   * who's booked there) before committing to a zone. */
  disableBooking?: boolean;
  onInfoClick?: () => void;
}) {
  const router = useRouter();
  const size = 200;
  const center = size / 2;
  const tableRadius = 60;

  const isBooked = table.isFullTableBooking || table.seatsReserved > 0;
  const canBook = !disableBooking && eventOpen && !isBooked;

  function goToFullTable() {
    if (disableBooking) return onInfoClick?.();
    if (!canBook) return;
    router.push(`/events/${eventId}/reserve/${table.id}?type=full_table`);
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full mx-auto select-none" style={{ maxWidth: maxWidthPx }}>
      <circle
        cx={center}
        cy={center}
        r={tableRadius}
        fill={isBooked ? "#ef4444" : "#22c55e"}
        stroke={isBooked ? "#dc2626" : "#16a34a"}
        strokeWidth={2}
        className={disableBooking || canBook ? "cursor-pointer" : ""}
        onClick={goToFullTable}
      >
        <title>{disableBooking ? "คลิกเพื่อดูข้อมูลโต๊ะ" : canBook ? "คลิกเพื่อเหมาโต๊ะ" : isBooked ? "จองแล้ว" : "ปิดรับจอง"}</title>
      </circle>
      <text
        x={center}
        y={center}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="80"
        fontWeight="700"
        fill="white"
        className={disableBooking || canBook ? "cursor-pointer" : "pointer-events-none"}
        onClick={goToFullTable}
      >
        {table.tableNumber}
      </text>
    </svg>
  );
}
