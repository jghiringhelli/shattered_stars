/**
 * PlanScoring — how the ManeuverPlanner values a predicted position: target
 * in my arc and range, me outside every enemy's arc, on the target's tail,
 * at a good range, not overshooting — and what a maneuver costs in stress.
 *
 * Pure: no Phaser.
 */

import { CYCLE_DURATION_MS } from "../../../config";
import {
  KTURN_STRESS_INSTANT,
  lookupDialDifficulty,
  STRESS_HIGH,
  STRESS_RATES,
} from "../../ArcadeStress";
import { REAR_ARC_HALF_DEG } from "../../ShotConditions";
import { extrapolatePose, offNoseDeg, torusOffset } from "../AiGeometry";
import type {
  OwnShipView,
  PerceivedShip,
  Pose,
  SpecialManeuver,
  SteerManeuver,
} from "../BotTypes";

/** One maneuver the planner may choose. */
export interface PlanOption {
  readonly maneuver: SteerManeuver | SpecialManeuver;
  readonly speed: number;
}

/** How much each aspect of a predicted position is worth. */
export interface PlanWeights {
  /** Target inside my arc and range. */
  readonly shoot: number;
  /** Gradient toward pointing at the target when it is not in arc. */
  readonly aim: number;
  /** Per 100 px away from the ideal range. */
  readonly range: number;
  /** In the target's rear arc. */
  readonly rear: number;
  /** Per enemy that has me in its arc and range. */
  readonly danger: number;
  /** Closer than {@link CROWDING_RANGE_PX} (overshoot risk). */
  readonly crowding: number;
  /** Weight of the best follow-up cycle. */
  readonly followUp: number;
  /** Weight of the pose halfway through the planned cycle (crossing an arc mid-turn). */
  readonly midCycle: number;
  /** Cost of a red maneuver. */
  readonly red: number;
  /** Cost of a red maneuver while already stressed (prolongs the stress). */
  readonly redWhileStressed: number;
  /** Cost of a maneuver that tips the pilot into the stressed state. */
  readonly becomeStressed: number;
  /** Bonus for a green maneuver while stressed (recover). */
  readonly recover: number;
}

/** An expert's priorities: shoot, stay out of arcs, sit on the tail. */
export const EXPERT_WEIGHTS: PlanWeights = {
  shoot: 10,
  aim: 4,
  range: 1,
  rear: 4,
  danger: 9,
  crowding: 3,
  followUp: 0.7,
  midCycle: 0.6,
  red: 0.5,
  redWhileStressed: 3,
  becomeStressed: 6,
  recover: 2,
};

/** Ideal range as a fraction of the weapon's range. */
export const IDEAL_RANGE_FRACTION = 0.55;

/** Closer than this the attacker risks overshooting its target (px). */
export const CROWDING_RANGE_PX = 60;

/** What the planner knows. */
export interface PlanInput {
  readonly self: OwnShipView;
  readonly target: PerceivedShip;
  readonly enemies: readonly PerceivedShip[];
  /** Age of the perceived snapshots (ms). */
  readonly perceptionAgeMs: number;
  readonly worldSize: number;
}

/** Predicted world at one moment. */
export interface Moment {
  readonly target: Pose;
  readonly threats: readonly (Pose & {
    readonly arc: number;
    readonly range: number;
  })[];
}

/**
 * @param input - Planner input.
 * @param ageMs - Time since the perceived snapshots (ms).
 * @returns Target and threats extrapolated to that moment.
 */
export function momentAt(input: PlanInput, ageMs: number): Moment {
  return {
    target: extrapolatePose(input.target, ageMs),
    threats: input.enemies.map((enemy) => ({
      ...extrapolatePose(enemy, ageMs),
      arc: enemy.firingArcDeg,
      range: enemy.weaponRange,
    })),
  };
}

/**
 * @param pose - A predicted own pose.
 * @param moment - The predicted world at that time.
 * @param input - Planner input (own arc and range).
 * @param weights - Scoring weights.
 * @returns How good the pose is against the predicted world.
 */
export function scorePose(
  pose: Pose,
  moment: Moment,
  input: PlanInput,
  weights: PlanWeights,
): number {
  const { self, worldSize } = input;
  const distance = torusOffset(pose, moment.target, worldSize).distance;
  const offNose = Math.abs(offNoseDeg(pose, moment.target, worldSize));
  const inArc = distance < self.weaponRange && offNose < self.firingArcDeg / 2;
  let score = inArc ? weights.shoot : weights.aim * (1 - offNose / 180);
  score -=
    (weights.range *
      Math.abs(distance - self.weaponRange * IDEAL_RANGE_FRACTION)) /
    100;
  if (
    Math.abs(offNoseDeg(moment.target, pose, worldSize)) >=
    180 - REAR_ARC_HALF_DEG
  )
    score += weights.rear;
  if (distance < CROWDING_RANGE_PX) score -= weights.crowding;
  for (const threat of moment.threats) {
    if (torusOffset(threat, pose, worldSize).distance >= threat.range) continue;
    if (Math.abs(offNoseDeg(threat, pose, worldSize)) < threat.arc / 2)
      score -= weights.danger;
  }
  return score;
}

/**
 * Stress the option costs: red maneuvers, tipping into the stressed state,
 * and (while stressed) the value of a green recovery cycle.
 * @param option - The candidate maneuver.
 * @param self - Own ship (stress, dial).
 * @param weights - Scoring weights.
 * @returns Cost to subtract from the option's score.
 */
export function stressCost(
  option: PlanOption,
  self: OwnShipView,
  weights: PlanWeights,
): number {
  const special =
    option.maneuver === "kturn" ||
    option.maneuver.startsWith("segnor") ||
    option.maneuver.startsWith("tallon");
  const dialDir = option.maneuver.includes("turn")
    ? "turn_left"
    : option.maneuver.includes("bank")
      ? "bank_left"
      : "straight";
  const difficulty = lookupDialDifficulty(dialDir, option.speed, self.dial);
  const projected =
    self.stressLevel +
    (special ? KTURN_STRESS_INSTANT : 0) +
    (STRESS_RATES[difficulty] * CYCLE_DURATION_MS) / 1000;
  let cost =
    difficulty === "red" || special
      ? self.isStressed
        ? weights.redWhileStressed
        : weights.red
      : 0;
  if (!self.isStressed && projected >= STRESS_HIGH)
    cost += weights.becomeStressed;
  if (self.isStressed && difficulty === "green") cost -= weights.recover;
  return cost;
}
