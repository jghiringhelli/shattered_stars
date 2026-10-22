/**
 * Stress screen-edge tint math — pure, no Phaser. State + level → alpha,
 * kept deliberately subtle, with a static, stepped variant for Reduce Motion.
 */

import { clamp01 } from "../theme/colorMath";
import type { StressTrack } from "./stressState";

/** Hard cap on the tint's opacity at the very edge of the screen. */
export const MAX_TINT_ALPHA = 0.3;
/** Stressed: base opacity at level 0 and the extra gained by level 1. */
const STRESSED_BASE = 0.14;
const STRESSED_GAIN = 0.14;
/** Recovering: opacity per unit of level (fades out with the level). */
const RECOVERING_PER_LEVEL = 0.2;
/** Reduced motion: one steady opacity per state. */
const REDUCED_STRESSED = 0.2;
const REDUCED_RECOVERING = 0.1;
/** Easing factor per frame toward the target. */
const SMOOTHING = 0.12;
/** Differences below this snap to the target (imperceptible). */
const SNAP_EPSILON = 0.002;
/** Number of stacked strips that fake the edge gradient. */
export const EDGE_BAND_COUNT = 14;

/**
 * Target tint opacity.
 *
 * @param track - Stress state from the HUD's own memory.
 * @param level - Stress level 0..1 (NaN tolerated).
 * @param reducedMotion - Reduce Motion / Flashes: static value per state.
 * @returns 0 when calm/normal; otherwise a subtle opacity ≤ MAX_TINT_ALPHA.
 */
export function stressTintAlpha(
  track: StressTrack,
  level: number,
  reducedMotion: boolean,
): number {
  const l = Number.isNaN(level) ? 0 : clamp01(level);
  if (track.kind === "stressed") {
    if (reducedMotion) return REDUCED_STRESSED;
    return Math.min(MAX_TINT_ALPHA, STRESSED_BASE + STRESSED_GAIN * l);
  }
  if (track.kind === "recovering") {
    if (reducedMotion) return REDUCED_RECOVERING;
    return Math.min(MAX_TINT_ALPHA, RECOVERING_PER_LEVEL * l);
  }
  return 0;
}

/**
 * Ease the drawn opacity toward the target (no pulse; one monotone approach).
 *
 * @param current - Opacity drawn last frame.
 * @param target - Wanted opacity.
 * @param reducedMotion - Jump straight to the target (stepped change).
 * @returns Next opacity; exactly the target once within imperceptible range.
 */
export function smoothTintAlpha(
  current: number,
  target: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return target;
  const diff = target - current;
  if (Math.abs(diff) < SNAP_EPSILON) return target;
  return current + diff * SMOOTHING;
}

/**
 * Opacity of one strip of the edge gradient.
 *
 * @param index - Strip index; 0 is at the screen edge.
 * @param edgeAlpha - Opacity at the edge.
 * @returns Opacity, falling quadratically to ~0 toward the screen centre.
 */
export function edgeBandAlpha(index: number, edgeAlpha: number): number {
  const t = 1 - index / EDGE_BAND_COUNT;
  return edgeAlpha * t * t;
}
