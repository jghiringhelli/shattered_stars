/**
 * ArcadeFlightTape — the machinery behind the arcade flight recorder: the
 * ship it spawns, the scripted actions and interrupts it applies, and the
 * tape that records every tick.
 *
 * Pure: no Phaser.
 */

import { SHIP_SIZES } from "../../config";
import {
  createControlState,
  startManeuver,
  type ShipControlState,
} from "../../core/ArcadeControls";
import { queueInterrupt } from "../../core/cycleInterrupt";
import type { ManeuverDirection, ShipState } from "../../core/types";
import {
  getMovementProfile,
  getShipDefinition,
} from "../../data/ShipDefinitions";
import type { MotionState, MotionStep } from "../../arcade/systems/ShipMotion";
import { performAction } from "../../arcade/systems/ShipActions";
import {
  UNRESTRICTED_CAPABILITIES,
  flightCapabilitiesOf,
} from "../../arcade/systems/FlightCapabilities";
import {
  ARCADE_FIXED_TICK_MS,
  type FlightOptions,
  type TelemetrySample,
  type TimedAction,
  type TimedInterrupt,
} from "./ArcadeFlightTypes";
import {
  torusDisplacement,
  type FlightStep,
  type Pose,
} from "./XWingFlightOracle";

/**
 * Build the ShipState the scene would spawn for a definition.
 * @param definitionId - Ship definition id.
 * @param pose - Spawn pose.
 * @returns A minimal ShipState.
 */
export function spawnShip(definitionId: string, pose: Pose): ShipState {
  return {
    id: `flight_${definitionId}`,
    definitionId,
    faction: getShipDefinition(definitionId)?.faction ?? "terran_hegemony",
    owner: "ai",
    x: pose.x,
    y: pose.y,
    angle: pose.angle,
    hull: 1,
    maxHull: 1,
    shields: 0,
    maxShields: 0,
    isStressed: false,
    hasFocus: false,
    hasEvade: false,
    hasTargetLock: null,
    isCloaked: false,
    currentManeuver: null,
    maneuverProgress: 0,
    mobileArcDirection: "front",
    charges: 0,
    maxCharges: 0,
  };
}

/**
 * Control state exactly as ArcadeBattleScene.createShip builds it, then
 * started directly on the plan's first maneuver.
 * @param ship - The spawned ship.
 * @param first - First maneuver of the plan.
 * @param dialCaps - Fly with the ship's dial speed caps (else unrestricted).
 * @returns The ready control state and the base size used.
 */
export function initialControl(
  ship: ShipState,
  first: FlightStep,
  dialCaps: boolean,
): { control: ShipControlState; baseSize: number } {
  const def = getShipDefinition(ship.definitionId);
  const baseSize = SHIP_SIZES[def?.baseStats.size ?? "small"] ?? 32;
  const created = createControlState(
    ship,
    baseSize,
    getMovementProfile(ship.definitionId),
    def?.baseStats.speed ?? { min: 1, max: 5 },
    dialCaps
      ? flightCapabilitiesOf(ship.definitionId, "identity")
      : UNRESTRICTED_CAPABILITIES,
  );
  const control = startManeuver(
    ship,
    { ...created, speed: first.speed },
    first.direction,
  );
  return { control, baseSize };
}

/**
 * Queue the next plan step (direction + speed) on the control state.
 * @param control - Current control state.
 * @param next - The step to fly next cycle, or undefined to hold straight.
 * @returns Control with the step queued.
 */
export function queueStep(
  control: ShipControlState,
  next: FlightStep | undefined,
): ShipControlState {
  if (!next) return control;
  return { ...control, speed: next.speed, nextManeuver: next.direction };
}

/**
 * @param options - The flight options.
 * @param tick - Tick index.
 * @returns The length of that tick (ms).
 */
export function tickLength(options: FlightOptions, tick: number): number {
  const { tickMs } = options;
  if (typeof tickMs === "function") return tickMs(tick);
  return tickMs ?? ARCADE_FIXED_TICK_MS;
}

/** Scripted requests still waiting for their time, earliest first. */
export interface DueQueues {
  readonly actions: TimedAction[];
  readonly interrupts: TimedInterrupt[];
}

/**
 * @param options - The flight options.
 * @returns Their scripted actions and interrupts, sorted by time.
 */
export function dueQueuesOf(options: FlightOptions): DueQueues {
  const byTime = <T extends { readonly atMs: number }>(
    list?: readonly T[],
  ): T[] => [...(list ?? [])].sort((a, b) => a.atMs - b.atMs);
  return {
    actions: byTime(options.actions),
    interrupts: byTime(options.interrupts),
  };
}

/**
 * Perform every flight action and queue every turn request due by `tMs`
 * (consumed from `due`).
 * @param state - Motion state.
 * @param ship - The ship.
 * @param due - Scripted actions and interrupts sorted by time (mutated).
 * @param clock - The tick's place in simulation time.
 * @returns The motion state after the actions.
 */
export function performDue(
  state: MotionState,
  ship: ShipState,
  due: DueQueues,
  clock: Pick<TickClock, "tMs" | "worldSize">,
): MotionState {
  let next = state;
  while (due.actions.length > 0 && due.actions[0]!.atMs <= clock.tMs)
    next = performAction(
      next,
      ship,
      due.actions.shift()!.action,
      clock.worldSize,
    ).state;
  while (due.interrupts.length > 0 && due.interrupts[0]!.atMs <= clock.tMs)
    next = {
      ...next,
      control: queueInterrupt(next.control, due.interrupts.shift()!.direction),
    };
  return next;
}

/** Mutable telemetry accumulated while a plan is flown. */
export interface Tape {
  unwrapped: { x: number; y: number };
  maxTickJumpPx: number;
  readonly cyclePoses: Pose[];
  readonly cycleEndMs: number[];
  readonly cycleSpeeds: number[];
  readonly cycleDirections: ManeuverDirection[];
  readonly cycleFractions: number[];
  readonly samples: TelemetrySample[];
}

/**
 * @param start - Where the flight starts.
 * @returns An empty tape.
 */
export function newTape(start: Pose): Tape {
  return {
    unwrapped: { x: start.x, y: start.y },
    maxTickJumpPx: 0,
    cyclePoses: [],
    cycleEndMs: [],
    cycleSpeeds: [],
    cycleDirections: [],
    cycleFractions: [],
    samples: [],
  };
}

/** Where in simulation time a tick sits. */
export interface TickClock {
  /** Simulation time at the end of the tick (ms). */
  readonly tMs: number;
  readonly dtMs: number;
  readonly worldSize: number;
}

/**
 * Record one tick: the sample, the teleport detector and, when a cycle ended
 * (to its boundary or cut short), its unwrapped end pose.
 * @param tape - The telemetry so far (mutated).
 * @param before - Motion state before the tick (and before scripted actions).
 * @param step - The tick's result.
 * @param clock - The tick's place in simulation time.
 */
export function recordTick(
  tape: Tape,
  before: MotionState,
  step: MotionStep,
  clock: TickClock,
): void {
  const { tMs, dtMs, worldSize } = clock;
  const move = torusDisplacement(before, step.state, worldSize);
  tape.maxTickJumpPx = Math.max(
    tape.maxTickJumpPx,
    Math.hypot(move.dx, move.dy),
  );
  const unwrappedBefore = tape.unwrapped;
  tape.unwrapped = {
    x: unwrappedBefore.x + move.dx,
    y: unwrappedBefore.y + move.dy,
  };
  tape.samples.push({
    tMs,
    x: tape.unwrapped.x,
    y: tape.unwrapped.y,
    angle: step.state.angle,
  });
  if (!step.completed) return;
  const { endPose } = step.completed;
  const toEnd = torusDisplacement(before, endPose, worldSize);
  tape.cyclePoses.push({
    x: unwrappedBefore.x + toEnd.dx,
    y: unwrappedBefore.y + toEnd.dy,
    angle: endPose.angle,
  });
  // A cut happens at the start of its tick; a boundary inside it.
  tape.cycleEndMs.push(
    step.completed.fraction < 1 ? tMs - dtMs : tMs - step.carriedMs,
  );
  tape.cycleSpeeds.push(step.completed.speed);
  tape.cycleDirections.push(step.completed.direction);
  tape.cycleFractions.push(step.completed.fraction);
}
