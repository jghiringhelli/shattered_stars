/**
 * MinHoldLatch — keeps a touch input "held" for a minimum time after it was
 * released. A finger tap is down and up within a frame or two, shorter than
 * the input poll and the gesture machines' flicker filters; the latch
 * stretches it into a press the pilot code reads like a key tap.
 *
 * Pure: no Phaser.
 */

/** A tap reads as held for at least this long (ms). */
export const TOUCH_MIN_HOLD_MS = 60;

export class MinHoldLatch {
  private value = 0;
  private activeSinceMs: number | null = null;
  private live = false;

  /**
   * The finger is down with this value (non-zero) or the value is 0 (idle).
   * @param value - Current input value.
   * @param nowMs - Time (ms).
   */
  press(value: number, nowMs: number): void {
    if (value === 0) {
      this.live = false;
      return;
    }
    if (this.activeSinceMs === null) this.activeSinceMs = nowMs;
    this.value = value;
    this.live = true;
  }

  /** The finger lifted: the value stays until the minimum hold has passed. */
  release(): void {
    this.live = false;
  }

  /**
   * @param nowMs - Time (ms).
   * @returns The value while pressed or still inside the minimum hold, else 0.
   */
  read(nowMs: number): number {
    if (this.activeSinceMs === null) return 0;
    if (this.live) return this.value;
    if (nowMs - this.activeSinceMs >= TOUCH_MIN_HOLD_MS) {
      this.activeSinceMs = null;
      return 0;
    }
    return this.value;
  }
}
/** Two taps of one gesture within a window. */
export class DoubleTapTracker {
  private lastTapMs = Number.NEGATIVE_INFINITY;

  /**
   * @param nowMs - Time of this tap (ms).
   * @param windowMs - Longest gap between the two taps (ms).
   * @returns True when this tap completes a double tap (the memory then resets).
   */
  tap(nowMs: number, windowMs: number): boolean {
    if (nowMs - this.lastTapMs <= windowMs) {
      this.lastTapMs = Number.NEGATIVE_INFINITY;
      return true;
    }
    this.lastTapMs = nowMs;
    return false;
  }
}
