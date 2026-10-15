/**
 * focusGeometry — pure spatial navigation for screens whose controls are
 * laid out freely (setup screens): which control an arrow key moves to, and
 * which control keeps the focus after the screen is rebuilt.
 */

/** A control's on-screen rectangle. */
export interface FocusBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Arrow directions. */
export type FocusDirection = "up" | "down" | "left" | "right";

/** Weight of the sideways offset against the distance along the key's axis. */
const CROSS_AXIS_WEIGHT = 2.5;

function centre(box: FocusBox): { readonly x: number; readonly y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * @param boxes - Control rectangles.
 * @returns Indices in reading order (top to bottom, left to right).
 */
export function readingOrder(boxes: readonly FocusBox[]): number[] {
  return boxes
    .map((box, index) => ({ index, ...centre(box) }))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((entry) => entry.index);
}

/**
 * @param boxes - Control rectangles.
 * @param current - Index of the focused control, -1 for none.
 * @param direction - The arrow pressed.
 * @returns The control to move to; the first in reading order when nothing is
 *   focused; the current one when nothing lies that way.
 */
export function nextByDirection(
  boxes: readonly FocusBox[],
  current: number,
  direction: FocusDirection,
): number {
  const here = boxes[current];
  if (!here) return readingOrder(boxes)[0] ?? -1;
  const from = centre(here);
  let best = current;
  let bestScore = Number.POSITIVE_INFINITY;
  boxes.forEach((box, index) => {
    if (index === current) return;
    const to = centre(box);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const along = { up: -dy, down: dy, left: -dx, right: dx }[direction];
    if (along <= 0) return;
    const across = direction === "up" || direction === "down" ? dx : dy;
    const score = along + CROSS_AXIS_WEIGHT * Math.abs(across);
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

/**
 * @param boxes - Control rectangles after a rebuild.
 * @param point - Where the previously focused control was.
 * @returns The control closest to the point, or -1 when there is none.
 */
export function nearestIndex(
  boxes: readonly FocusBox[],
  point: { readonly x: number; readonly y: number },
): number {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  boxes.forEach((box, index) => {
    const c = centre(box);
    const distance = Math.hypot(c.x - point.x, c.y - point.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

/**
 * @param box - A rectangle.
 * @returns Its centre point.
 */
export function boxCentre(box: FocusBox): { readonly x: number; readonly y: number } {
  return centre(box);
}
