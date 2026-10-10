/**
 * XWingFlightOracle — where a ship MUST be after flying a sequence of
 * maneuvers, computed from the X-Wing 2.0 rules, independently of the game's
 * own template tables (src/systems/MovementSystem.ts).
 *
 * The flight-telemetry battery flies ships through the real arcade motion code
 * and compares every cycle-end pose against this oracle. If the two disagree,
 * the game is wrong (or the rule below is, and the spec must change first).
 *
 * Rules (docs/specs/telemetry-xwing-reference.md, ADR-0001):
 * - Template length L = speed × SPEED_SCALE_FACTOR + base size; speed 0 = stay put.
 * - Arcs travel along their chord: hard turn chord at 45° (θ/2 of a 90° arc);
 *   bank chord at BANK_CHORD_DEG (MOV-5 documented deviation, ADR-0001).
 * - K-turn: straight template, then rotate 180°.
 * - Segnor's Loop: bank template, then rotate 180° → net facing ±45° + 180°.
 * - Tallon Roll: turn template, then rotate 90° toward the turn → net ±180°.
 * - Barrel roll: slide sideways one speed-1 template + base, facing unchanged.
 *
 * Pure: no Phaser, no game-template imports.
 */

import {
  SPEED_SCALE_FACTOR,
  SUSTAINED_TURN_DEGREES_PER_CYCLE,
} from "../../config";
import type { ManeuverDirection } from "../../core/types";

/** A ship pose: position in px, heading in degrees (0 = up, clockwise +). */
export interface Pose {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/** One maneuver in a flight plan. */
export interface FlightStep {
  readonly direction: ManeuverDirection;
  readonly speed: number;
}

/**
 * Bank chord angle from the entry heading. A true 45° arc has a 22.5° chord;
 * the game ships 30° as a documented, accepted deviation (MOV-5, ADR-0001).
 */
export const BANK_CHORD_DEG = 30;

/** Hard-turn chord angle: half of the 90° facing change (true circular arc). */
export const TURN_CHORD_DEG = 45;

interface ManeuverRule {
  /** Chord direction relative to the entry heading (deg, + = right). */
  readonly chordDeg: number;
  /** Facing change after the maneuver (deg, + = clockwise). */
  readonly facingDeg: number;
}

/** The X-Wing 2.0 rule for every dial maneuver (plus the arcade drift). */
export const XWING_RULES: Readonly<Record<ManeuverDirection, ManeuverRule>> = {
  straight: { chordDeg: 0, facingDeg: 0 },
  bank_left: { chordDeg: -BANK_CHORD_DEG, facingDeg: -45 },
  bank_right: { chordDeg: BANK_CHORD_DEG, facingDeg: 45 },
  turn_left: { chordDeg: -TURN_CHORD_DEG, facingDeg: -90 },
  turn_right: { chordDeg: TURN_CHORD_DEG, facingDeg: 90 },
  kturn: { chordDeg: 0, facingDeg: 180 },
  segnor_left: { chordDeg: -BANK_CHORD_DEG, facingDeg: -45 + 180 },
  segnor_right: { chordDeg: BANK_CHORD_DEG, facingDeg: 45 + 180 },
  tallon_left: { chordDeg: -TURN_CHORD_DEG, facingDeg: -90 - 90 },
  tallon_right: { chordDeg: TURN_CHORD_DEG, facingDeg: 90 + 90 },
  drift_left: {
    chordDeg: -SUSTAINED_TURN_DEGREES_PER_CYCLE / 2,
    facingDeg: -SUSTAINED_TURN_DEGREES_PER_CYCLE,
  },
  drift_right: {
    chordDeg: SUSTAINED_TURN_DEGREES_PER_CYCLE / 2,
    facingDeg: SUSTAINED_TURN_DEGREES_PER_CYCLE,
  },
};

/**
 * Normalize a heading to [0, 360).
 * @param deg - Heading in degrees.
 * @returns The equivalent heading in [0, 360).
 */
export function normalizeHeading(deg: number): number {
  const wrapped = ((deg % 360) + 360) % 360;
  return wrapped === 360 ? 0 : wrapped;
}

/**
 * Signed smallest difference between two headings, in (−180, 180].
 * @param a - First heading (deg).
 * @param b - Second heading (deg).
 * @returns a − b, wrapped.
 */
export function headingDelta(a: number, b: number): number {
  let d = normalizeHeading(a - b);
  if (d > 180) d -= 360;
  return d;
}

/**
 * Template length for a maneuver: the template plus one base, or nothing at
 * speed 0 (a stationary capital does not move).
 * @param speed - Maneuver speed.
 * @param baseSize - Ship base size in px.
 * @returns Center-to-center travel in px.
 */
export function templateLength(speed: number, baseSize: number): number {
  return speed > 0 ? speed * SPEED_SCALE_FACTOR + baseSize : 0;
}

/**
 * Move a pose along a heading-relative direction.
 * @param pose - Starting pose.
 * @param relativeDeg - Direction relative to the pose heading (+ = right).
 * @param distance - Distance in px.
 * @returns The translated pose (heading unchanged).
 */
export function translate(
  pose: Pose,
  relativeDeg: number,
  distance: number,
): Pose {
  const rad = ((pose.angle + relativeDeg) * Math.PI) / 180;
  return {
    x: pose.x + Math.sin(rad) * distance,
    y: pose.y - Math.cos(rad) * distance,
    angle: pose.angle,
  };
}

/**
 * Where a ship ends after one maneuver.
 * @param pose - Pose at the start of the maneuver.
 * @param step - The maneuver flown.
 * @param baseSize - Ship base size in px.
 * @returns The pose at the end of the maneuver.
 */
export function predictManeuver(
  pose: Pose,
  step: FlightStep,
  baseSize: number,
): Pose {
  const rule = XWING_RULES[step.direction];
  const moved = translate(
    pose,
    rule.chordDeg,
    templateLength(step.speed, baseSize),
  );
  return { ...moved, angle: normalizeHeading(pose.angle + rule.facingDeg) };
}

/**
 * Cycle-end poses for a whole flight plan.
 * @param start - Starting pose.
 * @param plan - Maneuvers, one per cycle.
 * @param baseSize - Ship base size in px.
 * @returns One pose per cycle, in order.
 */
export function predictFlight(
  start: Pose,
  plan: ReadonlyArray<FlightStep>,
  baseSize: number,
): Pose[] {
  const poses: Pose[] = [];
  let pose = start;
  for (const step of plan) {
    pose = predictManeuver(pose, step, baseSize);
    poses.push(pose);
  }
  return poses;
}

/**
 * Barrel roll: slide sideways one speed-1 template plus base, facing unchanged.
 * @param pose - Pose before the roll.
 * @param side - Roll direction.
 * @param baseSize - Ship base size in px.
 * @returns Pose after the roll.
 */
export function predictBarrelRoll(
  pose: Pose,
  side: "left" | "right",
  baseSize: number,
): Pose {
  return translate(
    pose,
    side === "left" ? -90 : 90,
    templateLength(1, baseSize),
  );
}

/**
 * Smallest torus displacement between two points.
 * @param from - Start point.
 * @param to - End point.
 * @param worldSize - Battlefield edge length.
 * @returns Shortest (dx, dy) across the wrap seam.
 */
export function torusDisplacement(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  worldSize: number,
): { dx: number; dy: number } {
  const half = worldSize / 2;
  const wrapAxis = (d: number): number =>
    d > half ? d - worldSize : d < -half ? d + worldSize : d;
  return { dx: wrapAxis(to.x - from.x), dy: wrapAxis(to.y - from.y) };
}
