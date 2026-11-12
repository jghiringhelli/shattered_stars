/**
 * CameraFollowFilter — frame-rate independent follow of a moving target on
 * the wrapping arena (pure; the Phaser camera is driven by the caller).
 *
 * Each step the centre advances with the target's smoothed velocity
 * (feed-forward) and closes the rest of the gap exponentially. On a straight
 * path the gap decays to zero, so the target stays at the screen centre at
 * any speed and any frame rate; a turn or a speed step only gives a small,
 * smooth lead or lag. Gaps larger than `snapDistancePx` (spawn, respawn,
 * resync) jump instead of sliding across the arena.
 */

import { torusAxisDelta } from "../../core/Torus";
import { smoothingGain, wrapIntoArena } from "./poseMath";

/** Where the camera should look, and how fast that point moves. */
export interface FollowSample {
  readonly x: number;
  readonly y: number;
  /** Velocity of the point (px/s). */
  readonly vx: number;
  readonly vy: number;
}

/** Tuning of {@link CameraFollowFilter}. */
export interface CameraFollowOptions {
  /** Arena edge length. */
  readonly worldSize: number;
  /** Time constant of the position gap (ms). Default 120. */
  readonly positionTimeMs?: number;
  /** Time constant of the velocity feed-forward (ms). Default 80. */
  readonly velocityTimeMs?: number;
  /** Time constant of the zoom (ms) — slow, so speed steps never pulse it. Default 800. */
  readonly zoomTimeMs?: number;
  /** Gap (px) beyond which the camera jumps. Default 500. */
  readonly snapDistancePx?: number;
  /** Longest frame one step integrates (ms); a hitch counts as this long. Default 100. */
  readonly maxStepMs?: number;
}

const DEFAULT_POSITION_MS = 120;
const DEFAULT_VELOCITY_MS = 80;
const DEFAULT_ZOOM_MS = 800;
const DEFAULT_SNAP_PX = 500;
const DEFAULT_MAX_STEP_MS = 100;
const MS_PER_SECOND = 1000;

export class CameraFollowFilter {
  /** View centre x, in [0, worldSize). */
  x = 0;
  /** View centre y, in [0, worldSize). */
  y = 0;
  /** Smoothed velocity of the centre (px/s). */
  vx = 0;
  vy = 0;
  /** Smoothed zoom. */
  zoom = 1;
  private placed = false;
  private readonly positionTimeMs: number;
  private readonly velocityTimeMs: number;
  private readonly zoomTimeMs: number;
  private readonly snapDistancePx: number;
  private readonly maxStepMs: number;

  /** @param options - Arena size and time constants. */
  constructor(private readonly options: CameraFollowOptions) {
    this.positionTimeMs = options.positionTimeMs ?? DEFAULT_POSITION_MS;
    this.velocityTimeMs = options.velocityTimeMs ?? DEFAULT_VELOCITY_MS;
    this.zoomTimeMs = options.zoomTimeMs ?? DEFAULT_ZOOM_MS;
    this.snapDistancePx = options.snapDistancePx ?? DEFAULT_SNAP_PX;
    this.maxStepMs = options.maxStepMs ?? DEFAULT_MAX_STEP_MS;
  }

  /** The next step jumps to its target (spawn, respawn, resync, focus change). */
  snapNext(): void {
    this.placed = false;
  }

  /**
   * @param target - The point to look at.
   * @param frameMs - Real frame time (ms).
   * @param zoomTarget - Zoom to ease toward, or null to leave zoom alone.
   */
  step(target: FollowSample, frameMs: number, zoomTarget: number | null): void {
    const dtMs = Math.min(Math.max(frameMs, 0), this.maxStepMs);
    if (zoomTarget !== null) {
      this.zoom += (zoomTarget - this.zoom) * smoothingGain(dtMs, this.zoomTimeMs);
    }
    const { worldSize } = this.options;
    const gapX = torusAxisDelta(this.x, target.x, worldSize);
    const gapY = torusAxisDelta(this.y, target.y, worldSize);
    if (!this.placed || Math.hypot(gapX, gapY) > this.snapDistancePx) {
      this.place(target);
      return;
    }
    if (dtMs <= 0) return;
    const velocityGain = smoothingGain(dtMs, this.velocityTimeMs);
    this.vx += (target.vx - this.vx) * velocityGain;
    this.vy += (target.vy - this.vy) * velocityGain;
    const positionGain = smoothingGain(dtMs, this.positionTimeMs);
    const seconds = dtMs / MS_PER_SECOND;
    const leadX = this.vx * seconds;
    const leadY = this.vy * seconds;
    this.x = wrapIntoArena(this.x + leadX + (gapX - leadX) * positionGain, worldSize);
    this.y = wrapIntoArena(this.y + leadY + (gapY - leadY) * positionGain, worldSize);
  }

  private place(target: FollowSample): void {
    this.x = wrapIntoArena(target.x, this.options.worldSize);
    this.y = wrapIntoArena(target.y, this.options.worldSize);
    this.vx = target.vx;
    this.vy = target.vy;
    this.placed = true;
  }
}
