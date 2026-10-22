/**
 * Speed distortion — pure math of the faint bow-wave effect on a ship that
 * flies at the MAXIMUM speed its current maneuver allows (src/core/speedCap).
 * Render-only: reads the control state, never writes it, no randomness.
 */

import type { ShipControlState } from "../../core/ArcadeControls";

/** The control fields the effect reads. */
export type SpeedDistortionSource = Pick<
  ShipControlState,
  "cycleSpeed" | "speedCap" | "maxSpeed" | "movementProfile"
>;

/** Intensity at the lowest notch that can reach its cap. */
export const MIN_NOTCH_INTENSITY = 0.4;
/** Speed notch at which the intensity is full. */
export const FULL_INTENSITY_NOTCH = 5;
/** Time to fade fully in or out when the state changes (ms). */
export const FADE_MS = 250;

/**
 * @param control - The player's control state.
 * @returns Target intensity 0..1: 0 unless the cycle is flown at the dial cap
 * of its maneuver (or at the ship's top notch when no cap applies); a higher
 * notch is a bit stronger; 0 for huge ships and a hovering ship.
 */
export function speedDistortionTarget(control: SpeedDistortionSource): number {
  if (control.movementProfile === "capital") return 0;
  const { cycleSpeed } = control;
  if (cycleSpeed <= 0) return 0;
  const cap = control.speedCap ?? control.maxSpeed;
  if (cycleSpeed < cap) return 0;
  const span = FULL_INTENSITY_NOTCH - 1;
  const notch = Math.min(1, Math.max(0, (cycleSpeed - 1) / span));
  return MIN_NOTCH_INTENSITY + (1 - MIN_NOTCH_INTENSITY) * notch;
}

/**
 * Moves the shown intensity toward its target at a constant rate so a full
 * change takes {@link FADE_MS}; never overshoots.
 *
 * @param current - Intensity shown last frame (0..1).
 * @param target - Wanted intensity (0..1).
 * @param deltaMs - Frame time in ms.
 * @param fadeMs - Duration of a full 0..1 change.
 * @returns The new shown intensity.
 */
export function smoothSpeedDistortion(
  current: number,
  target: number,
  deltaMs: number,
  fadeMs: number = FADE_MS,
): number {
  if (!(deltaMs > 0)) return current;
  const step = deltaMs / fadeMs;
  if (current < target) return Math.min(target, current + step);
  return Math.max(target, current - step);
}

/** One thin compression arc of the bow wave, in ship-local units. */
export interface BowArc {
  /** Distance ahead of the nose, in hull radii (0 = at the nose). */
  ahead: number;
  /** Half-width of the arc, in hull radii. */
  halfWidth: number;
  /** 0..1 opacity factor of the arc (rises, then fades as it drifts back). */
  fade: number;
}

/** Number of arcs in flight at once. */
export const BOW_ARC_COUNT = 3;
/** Seconds one arc takes to drift from the front to the hull. */
export const BOW_ARC_PERIOD_S = 0.9;
/** How far ahead of the nose an arc starts, in hull radii. */
const ARC_START_AHEAD = 0.9;
/** Arc half-width at the start and at the hull, in hull radii. */
const ARC_START_HALF_WIDTH = 0.35;
const ARC_END_HALF_WIDTH = 0.8;

/** @returns Reusable arc slots for {@link bowArcsAt}. */
export function createBowArcs(): BowArc[] {
  return Array.from({ length: BOW_ARC_COUNT }, () => ({
    ahead: 0,
    halfWidth: 0,
    fade: 0,
  }));
}

/**
 * Fills `arcs` for a point in time: each arc is born ahead of the nose and
 * drifts back along the hull, widening and fading. Deterministic in the
 * clock; allocates nothing.
 *
 * @param seconds - Scene clock, seconds.
 * @param arcs - Slots from {@link createBowArcs}, rewritten in place.
 */
export function bowArcsAt(seconds: number, arcs: readonly BowArc[]): void {
  arcs.forEach((arc, index) => {
    const raw = seconds / BOW_ARC_PERIOD_S + index / BOW_ARC_COUNT;
    const phase = raw - Math.floor(raw);
    arc.ahead = ARC_START_AHEAD * (1 - phase);
    arc.halfWidth =
      ARC_START_HALF_WIDTH +
      (ARC_END_HALF_WIDTH - ARC_START_HALF_WIDTH) * phase;
    arc.fade = Math.min(1, phase * 6) * (1 - phase);
  });
}
