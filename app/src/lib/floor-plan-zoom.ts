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

export function computeZoomFrame(
  tables: PosTable[],
  selectedZone: string | null,
  // padding (percent of the floor plan) kept around the zone's bounding box.
  // The default (14) matches the original behavior used by the admin
  // overview; the guest booking flow passes a smaller value so a zone fills
  // more of a phone screen and the table markers end up big enough to tap.
  opts: {
    pad?: number;
    // When the real viewport size is known, pick the scale that fits the whole
    // zone on screen (both dimensions) instead of the width/height heuristic
    // below, but never zoom out below what keeps a table marker tappable on a
    // narrow phone screen. width/height are the visible viewport in pixels;
    // imageRatio is the floor-plan image's width/height.
    viewport?: { width: number; height: number; imageRatio: number };
  } = {}
) {
  if (selectedZone === null) return { cx: 50, cy: 50, scale: 1 };

  const inZone = tables.filter(
    (t) => zoneKey(t.zone) === selectedZone && t.posX !== null && t.posY !== null
  ) as { posX: number; posY: number }[];

  if (inZone.length === 0) return { cx: 50, cy: 50, scale: 1 };

  const minX = Math.min(...inZone.map((t) => t.posX));
  const maxX = Math.max(...inZone.map((t) => t.posX));
  const minY = Math.min(...inZone.map((t) => t.posY));
  const maxY = Math.max(...inZone.map((t) => t.posY));

  const PAD = opts.pad ?? 14; // percent padding around the zone's bounding box
  const width = Math.max(1, maxX - minX + PAD * 2);
  const height = Math.max(1, maxY - minY + PAD * 2);

  // Zoom to fit the *tighter* of the two dimensions, rather than requiring
  // both to fit (which is what made tall/narrow zones barely zoom at all
  // before). The looser dimension is handled by scrolling instead.
  let scale = Math.max(1, Math.min(8, 100 / Math.min(width, height)));
  if (opts.viewport && opts.viewport.width > 0 && opts.viewport.height > 0) {
    const { width: vw, height: vh, imageRatio } = opts.viewport;
    // Largest zoom at which the zone's bounding box still fits the viewport
    // horizontally (fitX) and vertically (fitY). The canvas is vw*scale wide
    // and (vw*scale)/imageRatio tall, hence the imageRatio term.
    const fitX = 100 / width;
    const fitY = (100 * vh * imageRatio) / (height * vw);
    // Floor: on a ~360px phone a zone that is big relative to the whole plan
    // would otherwise be "fit" so small that markers are untappable, so keep
    // at least ~2.2x there and let the guest scroll (no floor on wide screens).
    const minTapScale = Math.max(1, 800 / vw);
    scale = Math.min(8, Math.max(1, minTapScale, Math.min(fitX, fitY)));
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return { cx, cy, scale };
}

// Frame for jumping straight to one table (table-number search): centered on
// the table at a fixed zoom, so the table and its neighbours fill the screen
// regardless of how big its zone is.
export function computeFocusFrame(t: { posX: number | null; posY: number | null }, viewportWidth = 0) {
  // ~1440px of canvas across the screen keeps table markers finger-sized on a
  // phone (4x of ~360px) without blowing up to a giant zoom on a wide screen.
  const scale = viewportWidth > 0 ? Math.min(4, Math.max(2, 1440 / viewportWidth)) : 4;
  return { cx: t.posX ?? 50, cy: t.posY ?? 50, scale };
}
