/**
 * BotKit — what every bot pilot shares: tier profiles (reaction, cadence,
 * noise), target picking, heading error with misjudgement, and the mapping
 * from a heading error to the maneuver a pilot steers with.
 *
 * Pure: no Phaser.
 */

import { offNoseDeg, torusOffset, type Point } from "../AiGeometry";
import type {
  BotProfile,
  PerceivedShip,
  Pose,
  SkillTier,
  SteerManeuver,
} from "../BotTypes";

/** Reaction delay, decision cadence and heading noise per tier. */
export const TIER_PROFILES: Readonly<Record<SkillTier, BotProfile>> = {
  novice: {
    tier: "novice",
    reactionMs: 500,
    decisionIntervalMs: 300,
    headingNoiseDeg: 35,
  },
  average: {
    tier: "average",
    reactionMs: 250,
    decisionIntervalMs: 150,
    headingNoiseDeg: 12,
  },
  expert: {
    tier: "expert",
    reactionMs: 120,
    decisionIntervalMs: 50,
    headingNoiseDeg: 3,
  },
};

/** Heading-error thresholds (°) at which a pilot escalates its steering. */
export interface SteerThresholds {
  /** Below this, hold course. */
  readonly hold: number;
  /** Below this, drift (30°). */
  readonly drift: number;
  /** Below this, bank (45°); above, hard turn (90°). */
  readonly bank: number;
}

/**
 * @param amplitude - Max misjudgement (±).
 * @param random - Seeded uniform source.
 * @returns A uniform error in [-amplitude, amplitude].
 */
export function noise(amplitude: number, random: () => number): number {
  return (random() * 2 - 1) * amplitude;
}

/**
 * @param from - Where the search starts.
 * @param ships - Candidates.
 * @param worldSize - Torus edge (px).
 * @returns The nearest candidate, or null when there are none.
 */
export function nearestShip(
  from: Point,
  ships: readonly PerceivedShip[],
  worldSize: number,
): PerceivedShip | null {
  let best: PerceivedShip | null = null;
  let bestDistance = Infinity;
  for (const ship of ships) {
    const { distance } = torusOffset(from, ship, worldSize);
    if (distance < bestDistance) {
      best = ship;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Heading error to a point as the pilot judges it.
 * @param self - The pilot's pose.
 * @param point - Where it wants to go.
 * @param worldSize - Torus edge (px).
 * @param misjudgeDeg - Error added by the pilot's misjudgement (°).
 * @returns Signed heading error (positive = to the right).
 */
export function judgedHeadingError(
  self: Pose,
  point: Point,
  worldSize: number,
  misjudgeDeg: number,
): number {
  return offNoseDeg(self, point, worldSize) + misjudgeDeg;
}

/**
 * The maneuver that corrects a heading error.
 * @param errorDeg - Signed heading error (positive = right).
 * @param thresholds - The pilot's escalation thresholds.
 * @param isStressed - A stressed pilot banks instead of turning.
 * @returns The steering maneuver to queue.
 */
export function steerForError(
  errorDeg: number,
  thresholds: SteerThresholds,
  isStressed: boolean,
): SteerManeuver {
  const magnitude = Math.abs(errorDeg);
  const side = errorDeg > 0 ? "right" : "left";
  if (magnitude < thresholds.hold) return "straight";
  if (magnitude < thresholds.drift) return `drift_${side}`;
  if (magnitude < thresholds.bank || isStressed) return `bank_${side}`;
  return `turn_${side}`;
}

/**
 * Where a ship will be after a lead time, from its observed velocity.
 * @param ship - Perceived ship.
 * @param leadMs - Lead time (ms).
 * @returns The lead point.
 */
export function leadPoint(ship: PerceivedShip, leadMs: number): Point {
  return { x: ship.x + ship.vx * leadMs, y: ship.y + ship.vy * leadMs };
}
