/**
 * ManeuverPlanner — how an expert reads the dial: for every maneuver it
 * could queue at the coming boundary (drift/bank/turn/straight at each
 * reachable throttle notch, K-turn, Segnor, Tallon) it resolves where the
 * template puts the ship, predicts where the target and every threat will
 * be, scores the result (target in my arc and range, me outside their arcs,
 * in the target's rear arc, good range, stress budget) and looks one more
 * cycle ahead.
 *
 * Pure: no Phaser. Uses the engine's own template geometry (resolveManeuver).
 */

import { CYCLE_DURATION_MS } from "../../../config";
import {
  findBestTurnSpeed,
  KTURN_STRESS_INSTANT,
  lookupDialDifficulty,
  STRESS_HIGH,
  STRESS_RATES,
} from "../../../arcade/ArcadeStress";
import { REAR_ARC_HALF_DEG } from "../../../arcade/ShotConditions";
import type { ManeuverDirection } from "../../../core/types";
import {
  generateManeuverPath,
  resolveManeuver,
} from "../../../systems/MovementSystem";
import { extrapolatePose, offNoseDeg, torusOffset } from "../ArenaGeometry";
import type {
  OwnShipView,
  PerceivedShip,
  Pose,
  SpecialManeuver,
  SteerManeuver,
} from "../SkillTypes";

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

const STEER_OPTIONS: readonly SteerManeuver[] = [
  "straight",
  "drift_left",
  "drift_right",
  "bank_left",
  "bank_right",
];
const TURN_OPTIONS: readonly SteerManeuver[] = ["turn_left", "turn_right"];
const SPECIAL_OPTIONS: readonly SpecialManeuver[] = [
  "segnor_left",
  "segnor_right",
  "tallon_left",
  "tallon_right",
];
const FOLLOW_UPS: readonly ManeuverDirection[] = [
  "straight",
  "bank_left",
  "bank_right",
  "turn_left",
  "turn_right",
];

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
interface Moment {
  readonly target: Pose;
  readonly threats: readonly (Pose & {
    readonly arc: number;
    readonly range: number;
  })[];
}

/**
 * @param input - Own ship, target, enemies, perception age, world size.
 * @param weights - Scoring weights.
 * @returns The best maneuver (and throttle) to queue at the coming boundary.
 */
export function planManeuver(
  input: PlanInput,
  weights: PlanWeights = EXPERT_WEIGHTS,
): PlanOption {
  const { self } = input;
  const t1 = input.perceptionAgeMs + self.msToCommit + CYCLE_DURATION_MS;
  const middle = momentAt(input, t1 - CYCLE_DURATION_MS / 2);
  const first = momentAt(input, t1);
  const second = momentAt(input, t1 + CYCLE_DURATION_MS);
  let best: PlanOption = { maneuver: "straight", speed: self.speed };
  let bestScore = -Infinity;
  for (const option of candidateOptions(self)) {
    const pose = poseAfter(
      self.endPose,
      option.maneuver,
      option.speed,
      self.baseSize,
    );
    const halfway = midPose(
      self.endPose,
      option.maneuver,
      option.speed,
      self.baseSize,
    );
    let follow = -Infinity;
    for (const speed of followUpSpeeds(option.speed, self)) {
      for (const next of FOLLOW_UPS) {
        const later = poseAfter(pose, next, speed, self.baseSize);
        follow = Math.max(follow, scorePose(later, second, input, weights));
      }
    }
    const score =
      scorePose(pose, first, input, weights) +
      weights.midCycle * scorePose(halfway, middle, input, weights) +
      weights.followUp * follow -
      stressCost(option, self, weights);
    if (score > bestScore) {
      best = option;
      bestScore = score;
    }
  }
  return best;
}

/**
 * @param self - Own ship.
 * @returns Every maneuver/throttle pair the pilot can reach by the boundary.
 */
export function candidateOptions(self: OwnShipView): PlanOption[] {
  const options: PlanOption[] = [];
  for (let speed = self.speed - 1; speed <= self.speed + 1; speed++) {
    if (speed < self.minSpeed || speed > self.maxSpeed) continue;
    for (const maneuver of STEER_OPTIONS) options.push({ maneuver, speed });
  }
  const turnSpeed = findBestTurnSpeed(
    self.dial,
    self.speed,
    self.minSpeed,
    self.maxSpeed,
    self.isStressed,
  );
  if (turnSpeed !== null)
    for (const maneuver of TURN_OPTIONS)
      options.push({ maneuver, speed: turnSpeed });
  if (!self.kturnReady) return options;
  if (!self.isStressed) options.push({ maneuver: "kturn", speed: self.speed });
  for (const maneuver of SPECIAL_OPTIONS)
    options.push({ maneuver, speed: self.speed });
  return options;
}

/**
 * @param speed - Throttle of the planned cycle.
 * @param self - Own ship (speed bounds).
 * @returns Throttles reachable for the follow-up cycle (same, one notch down).
 */
function followUpSpeeds(speed: number, self: OwnShipView): number[] {
  return speed - 1 >= self.minSpeed ? [speed, speed - 1] : [speed];
}

/**
 * @returns Where a maneuver template puts a ship starting at `from`.
 */
function poseAfter(
  from: Pose,
  direction: ManeuverDirection,
  speed: number,
  baseSize: number,
): Pose {
  const end = resolveManeuver(
    from.x,
    from.y,
    from.angle,
    { direction, speed, difficulty: "white" },
    baseSize,
  );
  return { x: end.targetX, y: end.targetY, angle: end.targetAngle };
}

/**
 * @returns The pose halfway along a maneuver template (where it may cross an arc).
 */
function midPose(
  from: Pose,
  direction: ManeuverDirection,
  speed: number,
  baseSize: number,
): Pose {
  const path = generateManeuverPath(
    from.x,
    from.y,
    from.angle,
    { direction, speed, difficulty: "white" },
    2,
    baseSize,
  );
  return path[1] ?? from;
}

/**
 * @param input - Planner input.
 * @param ageMs - Time since the perceived snapshots (ms).
 * @returns Target and threats extrapolated to that moment.
 */
function momentAt(input: PlanInput, ageMs: number): Moment {
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
 * @returns How good a predicted own pose is against the predicted world.
 */
function scorePose(
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
 * @returns Cost to subtract from the option's score.
 */
function stressCost(
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
