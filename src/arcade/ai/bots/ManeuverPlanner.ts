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
import { findBestTurnSpeed } from "../../ArcadeStress";
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
  // Only what the card and stress allow (BotView.availableSpecials).
  if (self.kturnReady) options.push({ maneuver: "kturn", speed: self.speed });
  for (const maneuver of SPECIAL_OPTIONS)
    if (self.availableSpecials.includes(maneuver))
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
