/**
 * Torus camera math — wraps a view centre into the arena and tracks an
 * unwrapped position for parallax.
 */

import { torusAxisDelta } from "../../core/Torus";

/** @returns `value` wrapped into [0, size). */
export function wrapIntoArena(value: number, size: number): number {
  return ((value % size) + size) % size;
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
