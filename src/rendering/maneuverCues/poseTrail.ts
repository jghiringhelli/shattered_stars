/**
 * PoseTrail — a fixed-size ring of timestamped poses, so the cue can draw
 * afterimages where the ship was a moment ago. Typed arrays, no allocation
 * per frame; `sampleAt` writes into a caller-owned object.
 */

import type { MotionPose } from "./maneuverCueMath";

const FIELDS = 4;
const HALF_TURN_DEG = 180;
const FULL_TURN_DEG = 360;

/** Mutable pose filled by {@link PoseTrail.sampleAt}. */
export interface PoseSample {
  x: number;
  y: number;
  angle: number;
}

/** Ring buffer of (time, x, y, angle) samples. */
export class PoseTrail {
  private readonly data: Float64Array;
  private readonly capacity: number;
  private count = 0;
  private head = 0;

  /** @param capacity - Samples kept (oldest are overwritten). */
  constructor(capacity: number) {
    this.capacity = Math.max(2, capacity);
    this.data = new Float64Array(this.capacity * FIELDS);
  }

  /**
   * Record a pose (times must not decrease).
   *
   * @param timeMs - Scene clock in ms.
   * @param pose - Where the ship is.
   */
  push(timeMs: number, pose: MotionPose): void {
    const at = this.head * FIELDS;
    this.data[at] = timeMs;
    this.data[at + 1] = pose.x;
    this.data[at + 2] = pose.y;
    this.data[at + 3] = pose.angle;
    this.head = (this.head + 1) % this.capacity;
    this.count = Math.min(this.capacity, this.count + 1);
  }

  /** Forget every sample. */
  clear(): void {
    this.count = 0;
    this.head = 0;
  }

  /**
   * Pose at a time, interpolated between the two samples around it and
   * clamped to the oldest / newest sample.
   *
   * @param timeMs - Wanted time.
   * @param out - Receives the pose.
   * @returns False when the trail is empty.
   */
  sampleAt(timeMs: number, out: PoseSample): boolean {
    if (this.count === 0) return false;
    let older = this.slot(0);
    if (timeMs <= this.data[older * FIELDS]!) return this.copy(older, out);
    for (let i = 1; i < this.count; i++) {
      const newer = this.slot(i);
      if (timeMs <= this.data[newer * FIELDS]!) {
        this.blend(older, newer, timeMs, out);
        return true;
      }
      older = newer;
    }
    return this.copy(older, out);
  }

  /** Buffer index of the i-th oldest sample. */
  private slot(i: number): number {
    return (this.head - this.count + i + this.capacity) % this.capacity;
  }

  private copy(slot: number, out: PoseSample): boolean {
    const at = slot * FIELDS;
    out.x = this.data[at + 1]!;
    out.y = this.data[at + 2]!;
    out.angle = this.data[at + 3]!;
    return true;
  }

  private blend(
    olderSlot: number,
    newerSlot: number,
    timeMs: number,
    out: PoseSample,
  ): void {
    const a = olderSlot * FIELDS;
    const b = newerSlot * FIELDS;
    const span = this.data[b]! - this.data[a]!;
    const f = span > 0 ? (timeMs - this.data[a]!) / span : 1;
    out.x = this.data[a + 1]! + (this.data[b + 1]! - this.data[a + 1]!) * f;
    out.y = this.data[a + 2]! + (this.data[b + 2]! - this.data[a + 2]!) * f;
    const turn =
      ((((this.data[b + 3]! - this.data[a + 3]!) % FULL_TURN_DEG) +
        FULL_TURN_DEG +
        HALF_TURN_DEG) %
        FULL_TURN_DEG) -
      HALF_TURN_DEG;
    out.angle =
      (((this.data[a + 3]! + turn * f) % FULL_TURN_DEG) + FULL_TURN_DEG) %
      FULL_TURN_DEG;
  }
}
