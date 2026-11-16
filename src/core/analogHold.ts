/**
 * analogHold — how long and at what rate the analog key must be held to fly
 * what a template maneuver asks for. Bots think in dial maneuvers (drift,
 * bank, turn); their hands turn that into a hold of the one turn key, and
 * their planner predicts the cycle from the same plan, so what they plan is
 * what they fly. A full-rate hold of the dial's own entry is the template.
 *
 * Pure: no Phaser.
 */

import { CYCLE_DURATION_MS, SUSTAINED_TURN_DEGREES_PER_CYCLE } from "../config";
import { flyBoostedLeg, holdMsFor } from "./analogBoost";
import {
  flyAnalogLeg,
  steeringCapacity,
  type AnalogSide,
} from "./analogSteering";
import {
  DEFAULT_ANALOG_TUNING,
  type AnalogTuning,
  type HeldBoost,
} from "./analogTuning";
import { flownSpeed, type DialSpeedTable } from "./speedCap";
import type { ManeuverDirection } from "./types";

/** The key hold that flies one cycle of a maneuver. */
export interface HoldPlan {
  readonly side: AnalogSide;
  /** Speed while the key is down (the turn speed). */
  readonly turnSpeed: number;
  /** Speed once it is released (the set speed through the dial). */
  readonly baseSpeed: number;
  /** Turn rate while down (°/cycle), before any boost. */
  readonly rateDeg: number;
  /** How long the key is down from the start of the cycle (ms). */
  readonly holdMs: number;
  /** The rate a long hold earns (src/core/analogTuning); null = none. */
  readonly boost: HeldBoost | null;
  /** How long the key was already down when the cycle started (ms). */
  readonly heldBeforeMs: number;
}

/** What shapes a hold besides the maneuver: the tuning and a hold carried over. */
export interface HoldOptions {
  /** Analog tuning (default: the default tuning). */
  readonly tuning?: AnalogTuning | undefined;
  /** How long the key was already down at the start of the cycle (ms; default 0). */
  readonly heldBeforeMs?: number | undefined;
}

/**
 * @param maneuver - A dial steering maneuver.
 * @param tuning - Analog tuning (the angles of a bank and a hard turn).
 * @returns The heading change it asks for per cycle (°); 0 for straight and specials.
 */
export function wantedDegrees(
  maneuver: ManeuverDirection,
  tuning: AnalogTuning = DEFAULT_ANALOG_TUNING,
): number {
  if (maneuver.startsWith("turn")) return tuning.turnDegrees;
  if (maneuver.startsWith("bank")) return tuning.bankDegrees;
  if (maneuver.startsWith("drift")) return SUSTAINED_TURN_DEGREES_PER_CYCLE;
  return 0;
}

/**
 * The hold that flies `maneuver` for one cycle at a set speed: the share of
 * the cycle that turns the wanted angle at the rate the dial allows there
 * (all of it when the dial allows less than wanted).
 *
 * @param maneuver - The dial maneuver wanted (left/right, drift/bank/turn/straight).
 * @param table - The ship's dial speeds.
 * @param setSpeed - The throttle for the cycle.
 * @param stressed - Whether the pilot is stressed.
 * @param options - Tuning and the hold already behind the cycle.
 * @returns Side, speeds, rate and hold time.
 */
export function holdPlanFor(
  maneuver: ManeuverDirection,
  table: DialSpeedTable | undefined,
  setSpeed: number,
  stressed: boolean,
  options: HoldOptions = {},
): HoldPlan {
  const tuning = options.tuning ?? DEFAULT_ANALOG_TUNING;
  const heldBeforeMs = options.heldBeforeMs ?? 0;
  const baseSpeed = flownSpeed(table, "straight", setSpeed);
  const wanted = wantedDegrees(maneuver, tuning);
  const capacity = steeringCapacity(table, setSpeed, stressed, tuning);
  const side: AnalogSide =
    wanted === 0 ? "none" : maneuver.endsWith("left") ? "left" : "right";
  return {
    side,
    turnSpeed: capacity.speed,
    baseSpeed,
    rateDeg: capacity.rateDeg,
    holdMs:
      wanted === 0
        ? 0
        : holdMsFor(wanted, capacity.rateDeg, capacity.boost, heldBeforeMs),
    boost: capacity.boost,
    heldBeforeMs,
  };
}

/**
 * Where a ship that flies the hold from the start of a cycle is after
 * `atMs`: an arc while the key is down, then straight at the set speed.
 *
 * @param from - Pose at the start of the cycle.
 * @param plan - The hold.
 * @param baseSize - Ship base size (px).
 * @param atMs - Time into the cycle (default: the whole cycle).
 * @returns The predicted pose.
 */
export function holdPlanPose(
  from: { readonly x: number; readonly y: number; readonly angle: number },
  plan: HoldPlan,
  baseSize: number,
  atMs: number = CYCLE_DURATION_MS,
): { x: number; y: number; angle: number } {
  const arcMs = Math.min(atMs, plan.holdMs);
  const arc = flyBoostedLeg(
    from,
    {
      speed: plan.turnSpeed,
      baseSize,
      rateDeg: plan.rateDeg,
      side: plan.side,
      durationMs: arcMs,
    },
    plan.boost,
    plan.heldBeforeMs,
  );
  return flyAnalogLeg(arc, {
    speed: plan.baseSpeed,
    baseSize,
    rateDeg: 0,
    side: "none",
    durationMs: atMs - arcMs,
  });
}
