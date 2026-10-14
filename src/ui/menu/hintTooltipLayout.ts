/**
 * hintTooltipLayout — where a hover tooltip goes: below-right of the
 * pointer, flipped to the other side near an edge, clamped on screen.
 * Pure: no Phaser.
 */

/** Gap between the pointer and the tooltip (px). */
export const TOOLTIP_OFFSET = 16;
/** Closest the tooltip comes to a screen edge (px). */
export const TOOLTIP_MARGIN = 8;

/** A point on screen. */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** A width / height pair. */
export interface ScreenSize {
  readonly width: number;
  readonly height: number;
}

function placeAxis(pointer: number, size: number, screen: number): number {
  const after = pointer + TOOLTIP_OFFSET;
  const before = pointer - TOOLTIP_OFFSET - size;
  const preferred = after + size <= screen - TOOLTIP_MARGIN ? after : before;
  const max = screen - TOOLTIP_MARGIN - size;
  return Math.max(TOOLTIP_MARGIN, Math.min(preferred, max));
}

/**
 * @param pointer - Pointer position.
 * @param size - Tooltip size.
 * @param screen - Screen size.
 * @returns The tooltip's top-left corner.
 */
export function tooltipPosition(
  pointer: ScreenPoint,
  size: ScreenSize,
  screen: ScreenSize,
): ScreenPoint {
  return {
    x: placeAxis(pointer.x, size.width, screen.width),
    y: placeAxis(pointer.y, size.height, screen.height),
  };
}

/** Gap between a hovered element and the tooltip beside it (px). */
export const TOOLTIP_GAP = 8;

/** A rectangle on screen. */
export interface ScreenRect extends ScreenPoint, ScreenSize {}

function clamp(value: number, size: number, screen: number): number {
  return Math.max(
    TOOLTIP_MARGIN,
    Math.min(value, screen - TOOLTIP_MARGIN - size),
  );
}

function overlaps(a: ScreenRect, b: ScreenRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function fitsOnScreen(box: ScreenRect, screen: ScreenSize): boolean {
  return (
    box.x >= TOOLTIP_MARGIN &&
    box.y >= TOOLTIP_MARGIN &&
    box.x + box.width <= screen.width - TOOLTIP_MARGIN &&
    box.y + box.height <= screen.height - TOOLTIP_MARGIN
  );
}

/**
 * Where a rich tooltip goes so it never covers the hovered element: below
 * it, else above, else to its right, else to its left — centred on the
 * pointer (or the element) along the free axis and clamped on screen. When
 * no side clears the element (it fills the screen) the tooltip sits beside
 * the pointer instead.
 *
 * @param target - Hovered element's bounds.
 * @param size - Tooltip size.
 * @param screen - Screen size.
 * @param pointer - Pointer position, when hovered by mouse.
 * @returns The tooltip's top-left corner.
 */
export function placeBesideTarget(
  target: ScreenRect,
  size: ScreenSize,
  screen: ScreenSize,
  pointer?: ScreenPoint,
): ScreenPoint {
  const anchorX = pointer?.x ?? target.x + target.width / 2;
  const anchorY = pointer?.y ?? target.y + target.height / 2;
  const centredX = clamp(anchorX - size.width / 2, size.width, screen.width);
  const centredY = clamp(anchorY - size.height / 2, size.height, screen.height);
  const candidates: ScreenPoint[] = [
    { x: centredX, y: target.y + target.height + TOOLTIP_GAP },
    { x: centredX, y: target.y - TOOLTIP_GAP - size.height },
    { x: target.x + target.width + TOOLTIP_GAP, y: centredY },
    { x: target.x - TOOLTIP_GAP - size.width, y: centredY },
  ];
  const clear = candidates.find((at) => {
    const box = { ...at, ...size };
    return fitsOnScreen(box, screen) && !overlaps(box, target);
  });
  return clear ?? tooltipPosition(pointer ?? { x: anchorX, y: anchorY }, size, screen);
}
