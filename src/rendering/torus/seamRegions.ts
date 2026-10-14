/**
 * Seam regions — pure math for seamless torus rendering.
 *
 * The arena wraps at `worldSize`, but ships are drawn at their plain
 * coordinates, so near an edge the other side of the arena is empty. The view
 * rig (TorusViewRig) fixes that by drawing the world again through extra
 * cameras, one per piece of the view that lies past a seam. This module
 * answers which pieces exist and how each extra camera must be set up.
 *
 * Terms: a *cell* is one arena-sized square of the infinite tiling (cell 0,0
 * is the real arena). A region shows cell (i, j) of the tiling, i.e. objects
 * of the real arena displaced by (i·S, j·S): display = source + offset.
 */

/** Most regions ever needed (3×3 cells around the arena minus the real one). */
export const MAX_SEAM_REGIONS = 8;

/** What the main camera sees, in world units. */
export interface SeamView {
  readonly centerX: number;
  readonly centerY: number;
  /** Half of the visible width (viewport width / (2·zoom)). */
  readonly halfWidth: number;
  /** Half of the visible height. */
  readonly halfHeight: number;
}

/** One piece of the view that lies in a neighbouring arena image. */
export interface SeamRegion {
  cellX: number;
  cellY: number;
  /** display = source + offset (cell · worldSize). */
  offsetX: number;
  offsetY: number;
  /** Displayed rectangle (world coordinates of the main camera). */
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Placement of an extra camera showing one region. */
export interface RegionCamera {
  x: number;
  y: number;
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

/** @returns A reusable, zeroed region pool of MAX_SEAM_REGIONS entries. */
export function createSeamRegions(): SeamRegion[] {
  const pool: SeamRegion[] = [];
  for (let i = 0; i < MAX_SEAM_REGIONS; i++) {
    pool.push({
      cellX: 0,
      cellY: 0,
      offsetX: 0,
      offsetY: 0,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
  }
  return pool;
}

/** @returns A zeroed camera placement for reuse. */
export function createRegionCamera(): RegionCamera {
  return { x: 0, y: 0, width: 0, height: 0, scrollX: 0, scrollY: 0 };
}

/**
 * Fill `out` with the neighbouring-image pieces the view overlaps. The
 * view's own arena (cell 0,0) is never reported: the main camera draws it.
 *
 * @param view - What the main camera sees.
 * @param worldSize - Arena edge length (px).
 * @param out - Pool from {@link createSeamRegions}; entries 0..n−1 are written.
 * @returns n, the number of regions written (no allocation).
 */
export function computeSeamRegions(
  view: SeamView,
  worldSize: number,
  out: SeamRegion[],
): number {
  const left = view.centerX - view.halfWidth;
  const right = view.centerX + view.halfWidth;
  const top = view.centerY - view.halfHeight;
  const bottom = view.centerY + view.halfHeight;
  const firstX = Math.floor(left / worldSize);
  const lastX = Math.floor(right / worldSize);
  const firstY = Math.floor(top / worldSize);
  const lastY = Math.floor(bottom / worldSize);
  let count = 0;
  for (let cellY = firstY; cellY <= lastY; cellY++) {
    const y0 = Math.max(top, cellY * worldSize);
    const y1 = Math.min(bottom, (cellY + 1) * worldSize);
    if (y1 <= y0) continue;
    for (let cellX = firstX; cellX <= lastX; cellX++) {
      if (cellX === 0 && cellY === 0) continue;
      const x0 = Math.max(left, cellX * worldSize);
      const x1 = Math.min(right, (cellX + 1) * worldSize);
      if (x1 <= x0 || count >= out.length) continue;
      const region = out[count++]!;
      region.cellX = cellX;
      region.cellY = cellY;
      region.offsetX = cellX * worldSize;
      region.offsetY = cellY * worldSize;
      region.left = x0;
      region.right = x1;
      region.top = y0;
      region.bottom = y1;
    }
  }
  return count;
}

/**
 * Set up an extra camera so it paints `region` exactly where the main camera
 * would show that part of the neighbouring arena image.
 *
 * Phaser maps world x to screen as `vx + vw/2 + zoom·(x − scrollX − vw/2)`
 * for a camera with viewport (vx, vw); the main camera is the special case
 * `scrollX = centerX − W/2` over the full screen.
 *
 * @param region - A region from {@link computeSeamRegions}.
 * @param view - The main camera's view.
 * @param zoom - Main camera zoom (> 0).
 * @param screen - Screen size in px.
 * @param out - Placement written in place.
 * @returns false when the region falls outside the screen (nothing to draw).
 */
export function placeRegionCamera(
  region: SeamRegion,
  view: SeamView,
  zoom: number,
  screen: { readonly width: number; readonly height: number },
  out: RegionCamera,
): boolean {
  const halfW = screen.width / 2;
  const halfH = screen.height / 2;
  const x0 = Math.max(0, Math.floor(halfW + zoom * (region.left - view.centerX)));
  const x1 = Math.min(
    screen.width,
    Math.ceil(halfW + zoom * (region.right - view.centerX)),
  );
  const y0 = Math.max(0, Math.floor(halfH + zoom * (region.top - view.centerY)));
  const y1 = Math.min(
    screen.height,
    Math.ceil(halfH + zoom * (region.bottom - view.centerY)),
  );
  if (x1 <= x0 || y1 <= y0) return false;
  out.x = x0;
  out.y = y0;
  out.width = x1 - x0;
  out.height = y1 - y0;
  out.scrollX =
    (x0 + out.width / 2 - halfW) / zoom -
    region.offsetX +
    view.centerX -
    out.width / 2;
  out.scrollY =
    (y0 + out.height / 2 - halfH) / zoom -
    region.offsetY +
    view.centerY -
    out.height / 2;
  return true;
}

/**
 * Whether a world object (real-arena coordinates) can show up in a region,
 * with slack for its own size. Objects at the origin are treated as
 * "everywhere": Graphics that draw in absolute coordinates sit at (0, 0).
 *
 * @param x - Object x.
 * @param y - Object y.
 * @param region - Region to test.
 * @param padding - Largest object half-extent to allow for.
 * @returns True when the object must be drawn by the region's camera.
 */
export function regionNeedsObject(
  x: number,
  y: number,
  region: SeamRegion,
  padding: number,
): boolean {
  if (x === 0 && y === 0) return true;
  const displayX = x + region.offsetX;
  const displayY = y + region.offsetY;
  return (
    displayX >= region.left - padding &&
    displayX <= region.right + padding &&
    displayY >= region.top - padding &&
    displayY <= region.bottom + padding
  );
}
