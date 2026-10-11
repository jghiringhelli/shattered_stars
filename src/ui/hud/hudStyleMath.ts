/**
 * Pure presentation math for the battle HUD — no Phaser.
 *
 * Arc angles are radians in Phaser's convention (0 = +x / right, clockwise
 * positive, 90° = down). Gauge inputs are tolerant: NaN, negative and
 * zero maxima all collapse to an empty gauge instead of throwing mid-frame.
 */

import { clamp01 } from "../theme/colorMath";

const DEG_TO_RAD = Math.PI / 180;
const FULL_TURN = Math.PI * 2;
/** Cooldown sweeps start at 12 o'clock. */
const SWEEP_ORIGIN = -Math.PI / 2;
/** Hull fraction above which the hull reads as healthy. */
export const HULL_HEALTHY_FRACTION = 0.6;
/** Hull fraction at or below which the hull reads as critical. */
export const HULL_CRITICAL_FRACTION = 0.3;

/**
 * Fill fraction of a gauge.
 *
 * @param value - Current value.
 * @param max - Maximum value.
 * @returns value / max clamped to [0, 1]; 0 when max is not positive.
 */
export function gaugeFraction(value: number, max: number): number {
  if (!(max > 0)) return 0;
  return clamp01(value / max);
}

/** How strongly to render a ship marker, by distance. */
export interface ClosenessStyle {
  /** False when the ship is beyond the far distance. */
  readonly visible: boolean;
  /** 1 at/inside near distance, 0 at far distance. */
  readonly closeness: number;
  readonly scale: number;
  readonly alpha: number;
}

/** Distance → style mapping parameters. */
export interface ClosenessOptions {
  /** At or below this distance the marker is at full size/brightness. */
  readonly nearDistance: number;
  /** Beyond this distance the marker is hidden. */
  readonly farDistance: number;
  readonly minScale: number;
  readonly maxScale: number;
  readonly minAlpha: number;
  readonly maxAlpha: number;
}

/**
 * Map a distance to marker scale and alpha: near = big/bright, far =
 * small/faint, beyond far = hidden. Linear in between.
 *
 * @param distance - Distance to the ship (world px).
 * @param options - Thresholds and output ranges.
 * @returns The style; when farDistance <= nearDistance it is a step at nearDistance.
 */
export function closenessStyle(
  distance: number,
  options: ClosenessOptions,
): ClosenessStyle {
  const span = options.farDistance - options.nearDistance;
  const beyondFar =
    span > 0 ? distance > options.farDistance : distance > options.nearDistance;
  if (beyondFar || Number.isNaN(distance)) {
    return { visible: false, closeness: 0, scale: options.minScale, alpha: 0 };
  }
  const closeness =
    span > 0 ? clamp01((options.farDistance - distance) / span) : 1;
  return {
    visible: true,
    closeness,
    scale: options.minScale + (options.maxScale - options.minScale) * closeness,
    alpha: options.minAlpha + (options.maxAlpha - options.minAlpha) * closeness,
  };
}

/** An arc between two angles, radians, drawn clockwise from start to end. */
export interface ArcSpan {
  readonly start: number;
  readonly end: number;
}

/**
 * The filled part of an arc gauge centred on `centerDeg`.
 *
 * @param centerDeg - Gauge centre angle in degrees (0 = right, 90 = down).
 * @param sweepDeg - Full gauge sweep in degrees.
 * @param fill - Fill fraction, clamped to [0, 1].
 * @param fromEnd - Grow from the clockwise end instead of the start.
 * @returns The filled span (zero-length when fill is 0).
 */
export function gaugeArc(
  centerDeg: number,
  sweepDeg: number,
  fill: number,
  fromEnd = false,
): ArcSpan {
  const sweep = Math.max(0, sweepDeg) * DEG_TO_RAD;
  const start = centerDeg * DEG_TO_RAD - sweep / 2;
  const end = start + sweep;
  const filled = sweep * clamp01(fill);
  return fromEnd
    ? { start: end - filled, end }
    : { start, end: start + filled };
}

/**
 * Split an arc gauge into equal segments separated by gaps.
 *
 * @param count - Number of segments; <= 0 yields none.
 * @param centerDeg - Gauge centre angle in degrees.
 * @param sweepDeg - Full gauge sweep in degrees.
 * @param gapDeg - Gap between segments; shrunk so segments never go negative.
 * @returns Segment spans in clockwise order.
 */
export function segmentArcs(
  count: number,
  centerDeg: number,
  sweepDeg: number,
  gapDeg: number,
): ArcSpan[] {
  const n = Math.floor(count);
  if (n <= 0) return [];
  const sweep = Math.max(0, sweepDeg);
  const gap = n > 1 ? Math.min(Math.max(0, gapDeg), sweep / (n - 1)) : 0;
  const segment = (sweep - gap * (n - 1)) / n;
  const first = centerDeg - sweep / 2;
  const spans: ArcSpan[] = [];
  for (let i = 0; i < n; i++) {
    const startDeg = first + i * (segment + gap);
    spans.push({
      start: startDeg * DEG_TO_RAD,
      end: (startDeg + segment) * DEG_TO_RAD,
    });
  }
  return spans;
}

/**
 * Fill of the `index`-th unit segment of a pip gauge holding `value` units.
 *
 * @param index - Zero-based segment index.
 * @param value - Current units (may be fractional).
 * @returns 1 for full segments, the remainder for the partial one, else 0.
 */
export function segmentFill(index: number, value: number): number {
  return clamp01(value - index);
}

/**
 * Clockwise cooldown sweep starting at 12 o'clock.
 *
 * @param cooldown - Remaining cooldown fraction (1 = just fired, 0 = ready).
 * @returns The span to shade, or null when ready.
 */
export function cooldownArc(cooldown: number): ArcSpan | null {
  const c = clamp01(cooldown);
  if (c === 0) return null;
  return { start: SWEEP_ORIGIN, end: SWEEP_ORIGIN + FULL_TURN * c };
}

/**
 * Colour-blend factor for the stress gauge: 0 calm → 1 stressed.
 *
 * @param level - Stress level 0..1.
 * @param isStressed - Latched stressed flag; forces 1.
 * @param stressedThreshold - Level at which stress becomes "stressed".
 * @returns Blend factor in [0, 1].
 */
export function stressBlend(
  level: number,
  isStressed: boolean,
  stressedThreshold: number,
): number {
  if (isStressed) return 1;
  if (!(stressedThreshold > 0)) return clamp01(level);
  return clamp01(level / stressedThreshold);
}

/** Qualitative hull state. */
export type HullStatus = "healthy" | "damaged" | "critical";

/**
 * Classify a hull fraction.
 *
 * @param fraction - Hull / maxHull in [0, 1].
 * @returns healthy above 0.6, critical at or below 0.3, damaged otherwise.
 */
export function hullStatus(fraction: number): HullStatus {
  if (fraction > HULL_HEALTHY_FRACTION) return "healthy";
  if (fraction > HULL_CRITICAL_FRACTION) return "damaged";
  return "critical";
}

/**
 * Centre offsets of `count` equal items laid out in a row.
 *
 * @param count - Number of items (<= 0 yields none).
 * @param itemSize - Item width.
 * @param gap - Space between items.
 * @returns Item centre x offsets, with the row centred on 0.
 */
export function rowCenters(
  count: number,
  itemSize: number,
  gap: number,
): number[] {
  const n = Math.floor(count);
  if (n <= 0) return [];
  const pitch = itemSize + gap;
  const first = -((n - 1) * pitch) / 2;
  return Array.from({ length: n }, (_, i) => first + i * pitch);
}
