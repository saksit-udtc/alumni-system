"use client";
import FloorPlanMap from "@/app/events/[id]/floor-plan-map";
import type { TableRow } from "@/app/events/[id]/table-graphic";

// Read-only reuse of the public "ผังโต๊ะ" floor-plan graphic for the admin
// overview page — same visual (floor plan image + colored table markers)
// as what alumni see, but tapping a table only opens the info modal
// (readOnly on FloorPlanMap), never the booking flow. Tables are passed in
// as a prop (already fetched by the parent page's admin API call) rather
// than re-fetched here, since the new scaffold's admin event endpoint
// already returns them alongside stats.
//
// Ported from the old Supabase app's admin-floor-plan-overview.tsx.
export default function AdminFloorPlanOverview({
  eventId,
  floorPlanUrl,
  tables,
  pricePerTable,
  pricePerSeat,
}: {
  eventId: string;
  floorPlanUrl: string;
  tables: TableRow[];
  pricePerTable: number;
  pricePerSeat: number;
}) {
  return (
    <FloorPlanMap
      floorPlanUrl={floorPlanUrl}
      tables={tables}
      eventId={eventId}
      eventOpen={false}
      pricePerTable={pricePerTable}
      pricePerSeat={pricePerSeat}
      readOnly
    />
  );
}
