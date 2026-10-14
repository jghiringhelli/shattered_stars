/**
 * Torus camera math — keeps a view centre inside the arena while following a
 * target the short way round, and tracks an unwrapped position for parallax.
 */

import { torusAxisDelta } from "../../core/Torus";

/** A view centre on the torus (mutable so per-frame stepping allocates nothing). */
export interface TorusCenter {
  x: number;
  y: number;
}

/** @returns `value` wrapped into [0, size). */
export function wrapIntoArena(value: number, size: number): number {
  return ((value % size) + size) % size;
}

/**
 * Move `center` a fraction of the way to `target` along the shortest torus
 * path, then wrap it back into the arena (no jump when the target crosses a
 * seam).
 *
 * @param center - Current centre; updated in place.
 * @param targetX - Target x.
 * @param targetY - Target y.
 * @param lerp - Fraction of the gap closed this step (0..1).
 * @param size - Arena edge length.
 */
export function stepTorusFollow(
  center: TorusCenter,
  targetX: number,
  targetY: number,
  lerp: number,
  size: number,
): void {
  center.x = wrapIntoArena(
    center.x + torusAxisDelta(center.x, targetX, size) * lerp,
    size,
  );
  center.y = wrapIntoArena(
    center.y + torusAxisDelta(center.y, targetY, size) * lerp,
    size,
  );
}

/**
 * Accumulates the camera's travel across seams so far layers keep scrolling
 * when the wrapped centre jumps from one edge to the other.
 */
export class UnwrappedTravel {
  private lastX = Number.NaN;
  private lastY = Number.NaN;
  /** Continuous x position (starts at the first observed centre). */
  x = 0;
  /** Continuous y position. */
  y = 0;

  /**
   * @param size - Arena edge length.
   */
  constructor(private readonly size: number) {}

  /**
   * Feed the wrapped camera centre; updates {@link x}/{@link y}.
   *
   * @param centerX - Wrapped centre x.
   * @param centerY - Wrapped centre y.
   */
  observe(centerX: number, centerY: number): void {
    if (Number.isNaN(this.lastX)) {
      this.x = centerX;
      this.y = centerY;
    } else {
      this.x += torusAxisDelta(this.lastX, centerX, this.size);
      this.y += torusAxisDelta(this.lastY, centerY, this.size);
    }
    this.lastX = centerX;
    this.lastY = centerY;
  }
}
