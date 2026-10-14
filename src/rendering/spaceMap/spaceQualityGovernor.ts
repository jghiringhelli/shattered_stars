/**
 * SpaceQualityGovernor — drops the space backdrop's optional layers when the
 * frame rate sinks, and brings them back (cautiously) when it recovers.
 * Pure and allocation-free: it only sees frame times.
 *
 * Levels: 3 = everything, 2 = no dust / decor, 1 = backdrop + far stars,
 * 0 = painted backdrop only.
 */

export const SPACE_QUALITY_FULL = 3;
export const SPACE_QUALITY_MIN = 0;

/** Smoothed frame time above which a level is dropped (≈ 42 fps). */
export const DROP_FRAME_MS = 24;
/** Smoothed frame time at or below which the sky may be restored (≈ 54 fps). */
export const RESTORE_FRAME_MS = 18.5;
/** How long the frame time must stay bad / good before the level changes. */
export const DROP_HOLD_MS = 1500;
export const RESTORE_HOLD_MS = 20_000;
/** Each drop doubles the wait before the next restore, up to this. */
export const RESTORE_HOLD_MAX_MS = 160_000;
/** Weight of the newest frame in the smoothed frame time. */
const SMOOTHING = 0.1;
/** Frames longer than this (tab switch, breakpoint) are ignored. */
const MAX_COUNTED_FRAME_MS = 250;

/** Renderer names (WebGL UNMASKED_RENDERER) of CPU rasterisers, where fill-rate is scarce. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/**
 * @param rendererName - The WebGL unmasked renderer string.
 * @returns True when it names a software rasteriser.
 */
export function isSoftwareRenderer(rendererName: string): boolean {
  return SOFTWARE_RENDERER.test(rendererName);
}

/** Level used on software renderers (backdrop + far stars). */
export const SPACE_QUALITY_SOFTWARE = 1;

export class SpaceQualityGovernor {
  private level: number;
  private smoothedMs: number;
  private badSinceMs = Number.NaN;
  private goodSinceMs = Number.NaN;
  private restoreHoldMs = RESTORE_HOLD_MS;

  /**
   * @param maxLevel - Highest level ever drawn (the start level too). Default: full.
   * @param startFrameMs - Initial smoothed frame time (ms). Default: 16.7 (60 fps).
   */
  constructor(
    private readonly maxLevel: number = SPACE_QUALITY_FULL,
    startFrameMs = 1000 / 60,
  ) {
    this.level = maxLevel;
    this.smoothedMs = startFrameMs;
  }

  /** @returns The current level (0..3). */
  get quality(): number {
    return this.level;
  }

  /**
   * Feed one frame.
   *
   * @param frameMs - Frame duration (ms).
   * @param nowMs - Monotonic clock (ms).
   * @returns The level to draw this frame at.
   */
  observe(frameMs: number, nowMs: number): number {
    if (frameMs > MAX_COUNTED_FRAME_MS || !(frameMs > 0)) return this.level;
    this.smoothedMs += (frameMs - this.smoothedMs) * SMOOTHING;
    if (this.smoothedMs > DROP_FRAME_MS) this.onBadFrame(nowMs);
    else {
      this.badSinceMs = Number.NaN;
      if (this.smoothedMs <= RESTORE_FRAME_MS) this.onGoodFrame(nowMs);
      else this.goodSinceMs = Number.NaN;
    }
    return this.level;
  }

  private onBadFrame(nowMs: number): void {
    this.goodSinceMs = Number.NaN;
    if (Number.isNaN(this.badSinceMs)) this.badSinceMs = nowMs;
    if (nowMs - this.badSinceMs < DROP_HOLD_MS || this.level === SPACE_QUALITY_MIN) return;
    this.level--;
    this.badSinceMs = nowMs;
    this.restoreHoldMs = Math.min(this.restoreHoldMs * 2, RESTORE_HOLD_MAX_MS);
  }

  private onGoodFrame(nowMs: number): void {
    if (Number.isNaN(this.goodSinceMs)) this.goodSinceMs = nowMs;
    if (nowMs - this.goodSinceMs < this.restoreHoldMs || this.level >= this.maxLevel) return;
    this.level++;
    this.goodSinceMs = nowMs;
  }
}
