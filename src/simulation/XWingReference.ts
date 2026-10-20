/**
 * Tabletop geometric reference for movement-telemetry fidelity.
 *
 * Anchors the game's per-cycle movement to the tabletop the tabletop game 2.0
 * geometry so speed, turn radius and facing change can be verified against a physical
 * reference. See docs/specs/telemetry-xwing-reference.md and docs/adr/ADR-0001.
 *
 * Pure module: no Phaser, no I/O. Consumed by the gate test and scripts/analyze_telemetry.ts.
 */

import { SPEED_SCALE_FACTOR, SHIP_SIZES, type ShipSize } from "../config";
import { resolveManeuver } from "../systems/MovementSystem";
import type {
  ManeuverDirection,
  DialManeuverDirection,
  ManeuverDifficulty,
} from "../core/types";

/** Canonical scale: pixels per millimetre, anchored by the straight templates. */
export const PX_PER_MM = 1;

/** Official tabletop straight template length per speed unit, in millimetres. */
export const XWING_STRAIGHT_MM_PER_SPEED = 40;

/** Official tabletop square base sizes, in millimetres. */
export const XWING_BASE_MM: Readonly<
  Record<"small" | "medium" | "large", number>
> = {
  small: 40,
  medium: 60,
  large: 80,
};

/** Facing change (degrees) per maneuver direction, per tabletop rules. */
export const XWING_FACING_CHANGE: Readonly<
  Record<DialManeuverDirection, number>
> = {
  straight: 0,
  bank_left: -45,
  bank_right: 45,
  turn_left: -90,
  turn_right: 90,
  kturn: 180,
  // Hook Loop = bank, then rotate 180°: −45° + 180° = +135° for a left loop.
  segnor_left: 135,
  segnor_right: -135,
  tallon_left: -180,
  tallon_right: 180,
};

/**
 * The maneuver directions the tabletop fidelity gates apply to.
 *
 * Derived from {@link XWING_FACING_CHANGE} so it stays exhaustive over the
 * dial. Arcade-only templates (drift_*) are deliberately excluded: they have
 * no tabletop counterpart, so holding them to tabletop facing-change rules would
 * be meaningless. Every *dial* maneuver remains gated.
 */
export const DIAL_DIRECTIONS: readonly DialManeuverDirection[] = Object.keys(
  XWING_FACING_CHANGE,
) as DialManeuverDirection[];

/** Templates that exist for arcade feel only and are outside the tabletop gates. */
export const NON_DIAL_DIRECTIONS: readonly ManeuverDirection[] = [
  "drift_left",
  "drift_right",
];

/** True circular-arc chord unit vectors (screen coords, forward = −Y). */
export const TRUE_ARC_CHORD = {
  /** 45° bank → chord angle 22.5° from heading. */
  bank: { x: Math.sin(Math.PI / 8), y: -Math.cos(Math.PI / 8) },
  /** 90° hard turn → chord angle 45° from heading. */
  turn: { x: Math.sin(Math.PI / 4), y: -Math.cos(Math.PI / 4) },
} as const;

/** A single measured maneuver derived from the game's own `resolveManeuver`. */
export interface ManeuverMeasurement {
  readonly direction: ManeuverDirection;
  readonly speed: number;
  readonly size: ShipSize;
  /** Center-to-center displacement magnitude, px. */
  readonly displacementPx: number;
  /** Facing change, degrees (normalized to (−180, 180]). */
  readonly facingChangeDeg: number;
  /** Displacement direction as a unit vector (screen coords). */
  readonly chordUnit: { readonly x: number; readonly y: number };
}

const GREEN: ManeuverDifficulty = "green";

/** Normalize a degree delta to the (−180, 180] interval. */
export function normalizeDelta(deg: number): number {
  let d = ((deg % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/**
 * Measure one maneuver using the game's own movement resolver from a canonical
 * origin (0,0) facing up (angle 0), so the result equals the raw template geometry.
 */
export function measureManeuver(
  direction: ManeuverDirection,
  speed: number,
  size: ShipSize,
): ManeuverMeasurement {
  const baseSize = SHIP_SIZES[size];
  const result = resolveManeuver(
    0,
    0,
    0,
    { direction, speed, difficulty: GREEN },
    baseSize,
  );
  const dx = result.targetX;
  const dy = result.targetY;
  const displacementPx = Math.hypot(dx, dy);
  const chordUnit =
    displacementPx === 0
      ? { x: 0, y: 0 }
      : { x: dx / displacementPx, y: dy / displacementPx };
  return {
    direction,
    speed,
    size,
    displacementPx,
    facingChangeDeg: normalizeDelta(result.targetAngle),
    chordUnit,
  };
}

/** Expected straight displacement (px) at the canonical scale for a given base. */
export function expectedStraightPx(speed: number, size: ShipSize): number {
  return speed * SPEED_SCALE_FACTOR + SHIP_SIZES[size];
}
