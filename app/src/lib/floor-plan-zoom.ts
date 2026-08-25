// Computes the pan/zoom needed to frame a zone's tables in a floor-plan
// viewport. Used by both the public booking map and the admin drag editor
// so "pick a zone, then the view zooms in" behaves identically in both.
//
// Implementation note: the "canvas" (the div holding the image + markers)
// always keeps the image's native aspect ratio and is simply rendered
// bigger (scaled) when zoomed — this is what keeps percent-based marker
// positions correct with zero distortion. The outer viewport becomes a
// scrollable window onto that bigger canvas (native browser scroll), and
// we scroll-to-center the selected zone on selection. This is important
// because many zones are tall/narrow strips that don't fit a fixed
// landscape frame — trying to change the viewport's own aspect ratio
// instead (an earlier attempt) breaks object-contain image fitting and
// scatters the markers, so don't do that again.
//
// Ported near-verbatim from the old Supabase app's lib/floor-plan-zoom.ts.
// Field names adjusted: the old app used posX/posY (Supabase columns);
// this scaffold's Prisma schema uses positionX/positionY on Table. Callers
// pass those in as posX/posY via this module's PosTable shape, so no other
// change was needed to the math itself.

export type PosTable = { zone: string | null; posX: number | null; posY: number | null };

export function zoneKey(zone: string | null) {
  return zone ?? "__unassigned__";
}

export function computeZoomFrame(tables: PosTable[], selectedZone: string | null) {
  if (selectedZone === null) return { cx: 50, cy: 50, scale: 1 };

  const inZone = tables.filter(
    (t) => zoneKey(t.zone) === selectedZone && t.posX !== null && t.posY !== null
  ) as { posX: number; posY: number }[];

  if (inZone.length === 0) return { cx: 50, cy: 50, scale: 1 };

  const minX = Math.min(...inZone.map((t) => t.posX));
  const maxX = Math.max(...inZone.map((t) => t.posX));
  const minY = Math.min(...inZone.map((t) => t.posY));
  const maxY = Math.max(...inZone.map((t) => t.posY));

  const PAD = 14; // percent padding around the zone's bounding box
  const width = Math.max(1, maxX - minX + PAD * 2);
  const height = Math.max(1, maxY - minY + PAD * 2);

  // Zoom to fit the *tighter* of the two dimensions, rather than requiring
  // both to fit (which is what made tall/narrow zones barely zoom at all
  // before). The looser dimension is handled by scrolling instead.
  const scale = Math.max(1, Math.min(8, 100 / Math.min(width, height)));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return { cx, cy, scale };
}
