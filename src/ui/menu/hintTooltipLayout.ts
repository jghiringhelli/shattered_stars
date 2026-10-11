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
