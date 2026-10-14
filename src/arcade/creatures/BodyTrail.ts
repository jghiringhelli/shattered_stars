/**
 * BodyTrail — the path a serpentine creature's head has flown, as a ring of
 * points, so its body segments can sit on it at fixed distances behind the
 * head. Points are recorded only after the head moved a minimum step (a
 * wrap across the map seam resets the trail). Allocation-free after
 * construction. Pure.
 */

/** A point the trail writes into. */
export interface TrailPoint {
  x: number;
  y: number;
}

/** Ring buffer of head positions, newest first when read. */
export class BodyTrail {
  private readonly xs: Float32Array;
  private readonly ys: Float32Array;
  private newest = -1;
  private count = 0;

  /**
   * @param capacity - Points kept.
   * @param minStepPx - Distance the head must move before a point is recorded.
   * @param seamJumpPx - A jump this long is a map-seam wrap: the trail restarts.
   */
  constructor(
    private readonly capacity: number,
    private readonly minStepPx: number,
    private readonly seamJumpPx: number,
  ) {
    this.xs = new Float32Array(capacity);
    this.ys = new Float32Array(capacity);
  }

  /**
   * @param x - Head x.
   * @param y - Head y.
   */
  record(x: number, y: number): void {
    if (this.count > 0) {
      const gap = Math.hypot(
        x - this.xs[this.newest]!,
        y - this.ys[this.newest]!,
      );
      if (gap >= this.seamJumpPx) this.count = 0;
      else if (gap < this.minStepPx) return;
    }
    this.newest = (this.newest + 1) % this.capacity;
    this.xs[this.newest] = x;
    this.ys[this.newest] = y;
    this.count = Math.min(this.capacity, this.count + 1);
  }

  /**
   * @param distancePx - Distance along the path behind the newest point.
   * @param out - Receives the point (the oldest one when the path is shorter).
   */
  pointAt(distancePx: number, out: TrailPoint): void {
    if (this.count === 0) return;
    let remaining = distancePx;
    let index = this.newest;
    for (let step = 1; step < this.count; step++) {
      const next = (index - 1 + this.capacity) % this.capacity;
      const dx = this.xs[next]! - this.xs[index]!;
      const dy = this.ys[next]! - this.ys[index]!;
      const length = Math.hypot(dx, dy);
      if (remaining <= length && length > 0) {
        const t = remaining / length;
        out.x = this.xs[index]! + dx * t;
        out.y = this.ys[index]! + dy * t;
        return;
      }
      remaining -= length;
      index = next;
    }
    out.x = this.xs[index]!;
    out.y = this.ys[index]!;
  }
}
