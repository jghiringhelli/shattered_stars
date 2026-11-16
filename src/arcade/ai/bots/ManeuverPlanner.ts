/**
 * ManeuverPlanner — how an expert reads the dial: for every maneuver it
 * could queue at the coming boundary (drift/bank/turn/straight at each
 * reachable throttle notch, Snap turn, Hook, Knife) it resolves where the
 * template puts the ship, predicts where the target and every threat will
 * be, scores the result (target in my arc and range, me outside their arcs,
 * in the target's rear arc, good range, stress budget) and looks one more
 * cycle ahead.
 *
 * Pure: no Phaser. Uses the engine's own template geometry (resolveManeuver).
 */

import { CYCLE_DURATION_MS } from "../../../config";
import { hardTurnThrottle } from "../../HardTurnThrottle";
import { flownSpeed } from "../../../core/speedCap";
import { holdPlanFor, holdPlanPose } from "../../../core/analogHold";
import type { ManeuverDirection } from "../../../core/types";
import {
  generateManeuverPath,
  resolveManeuver,
} from "../../../systems/MovementSystem";
import type {
  OwnShipView,
  Pose,
  SpecialManeuver,
  SteerManeuver,
} from "../BotTypes";
import {
  EXPERT_WEIGHTS,
  momentAt,
  scorePose,
  stressCost,
  type PlanInput,
  type PlanOption,
  type PlanWeights,
} from "./PlanScoring";

export {
  CROWDING_RANGE_PX,
  EXPERT_WEIGHTS,
  IDEAL_RANGE_FRACTION,
  type PlanInput,
  type PlanOption,
  type PlanWeights,
} from "./PlanScoring";

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
    const pose = cyclePose(self, self.endPose, option.maneuver, option.speed);
    const halfway = cyclePose(
      self,
      self.endPose,
      option.maneuver,
      option.speed,
      CYCLE_DURATION_MS / 2,
    );
    let follow = -Infinity;
    for (const speed of followUpSpeeds(option.speed, self)) {
      for (const next of FOLLOW_UPS) {
        const later = cyclePose(self, pose, next, speed);
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
 * Throttles a hard turn can be planned at. Template: the one the player's
 * Q/E uses (the cap flies the turn at the dial's turn speed). Analog: the
 * key turns 90° only at a speed whose dial entry is a hard turn, so every
 * throttle the pilot can reach is an option (taps slow the ship for it).
 *
 * @param self - Own ship.
 * @returns The throttles to offer hard turns at (none when the dial has no turn).
 */
function hardTurnSpeeds(self: OwnShipView): number[] {
  if (self.analogSteering === true) {
    if (!self.dialSpeeds?.turn?.length) return [];
    return [self.speed, self.speed - 1, self.speed + 1].filter(
      (speed) => speed >= self.minSpeed && speed <= self.maxSpeed,
    );
  }
  const turnSpeed = hardTurnThrottle({
    dial: self.dial,
    dialSpeeds: self.dialSpeeds,
    speed: self.speed,
    minSpeed: self.minSpeed,
    maxSpeed: self.maxSpeed,
    isStressed: self.isStressed,
  });
  return turnSpeed === null ? [] : [turnSpeed];
}

/**
 * @param self - Own ship.
 * @returns Every maneuver/throttle pair the pilot can reach by the boundary.
 */
export function candidateOptions(self: OwnShipView): PlanOption[] {
  const options: PlanOption[] = [];
  // Keep the throttle first: options that fly the same capped speed tie, and
  // the first of a tie wins, so a ship never slows down just to bank.
  for (const speed of [self.speed, self.speed + 1, self.speed - 1]) {
    if (speed < self.minSpeed || speed > self.maxSpeed) continue;
    for (const maneuver of STEER_OPTIONS) options.push({ maneuver, speed });
  }
  const turnSpeeds = hardTurnSpeeds(self);
  for (const speed of turnSpeeds)
    for (const maneuver of TURN_OPTIONS) options.push({ maneuver, speed });
  // Only what the card and stress allow (BotView.availableSpecials).
  if (self.kturnReady) options.push({ maneuver: "kturn", speed: self.speed });
  for (const maneuver of SPECIAL_OPTIONS)
    if (self.availableSpecials.includes(maneuver))
      options.push({ maneuver, speed: self.speed });
  return options;
}

/**
 * @param self - Own ship.
 * @param option - A maneuver and throttle the pilot could queue.
 * @returns Where the template puts the ship at the coming boundary, flown at
 * the speed the dial allows for it (min of throttle and cap).
 */
export function plannedPose(self: OwnShipView, option: PlanOption): Pose {
  return cyclePose(self, self.endPose, option.maneuver, option.speed);
}

/**
 * Where one cycle of a maneuver puts the ship: the template at the flown
 * speed, or for an analog pilot the key hold that flies it (arc, then
 * straight). Specials are templates in both modes.
 *
 * @param self - Own ship (dial speeds, base size, steering mode, stress).
 * @param from - Pose at the start of the cycle.
 * @param maneuver - The maneuver flown.
 * @param speed - The throttle for the cycle.
 * @param atMs - Time into the cycle (default: the whole cycle).
 * @returns The predicted pose.
 */
function cyclePose(
  self: OwnShipView,
  from: Pose,
  maneuver: ManeuverDirection,
  speed: number,
  atMs: number = CYCLE_DURATION_MS,
): Pose {
  if (self.analogSteering === true && !isSpecial(maneuver)) {
    const plan = holdPlanFor(
      maneuver,
      self.dialSpeeds,
      speed,
      self.isStressed,
      { tuning: self.analogTuning },
    );
    return holdPlanPose(from, plan, self.baseSize, atMs);
  }
  const flown = flownSpeed(self.dialSpeeds, maneuver, speed);
  return atMs >= CYCLE_DURATION_MS
    ? poseAfter(from, maneuver, flown, self.baseSize)
    : midPose(from, maneuver, flown, self.baseSize);
}

/**
 * @param maneuver - Any maneuver.
 * @returns Whether it is an atomic special (Snap turn, Hook, Knife).
 */
function isSpecial(maneuver: ManeuverDirection): boolean {
  return (
    maneuver === "kturn" ||
    maneuver.startsWith("segnor") ||
    maneuver.startsWith("tallon")
  );
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
