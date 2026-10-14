/**
 * ArcadeFlightRecorder — flies one ship through the REAL arcade motion code
 * (ShipMotion.stepMotion, the same step ArcadeBattleScene runs) on a fixed
 * flight plan and records its telemetry.
 *
 * Positions are recorded both wrapped (what the scene stores) and unwrapped
 * (accumulated torus displacement), so a ship crossing the battlefield seam can
 * still be compared against the oracle in one continuous frame of reference.
 *
 * Pure: no Phaser. Consumed by the flight-telemetry test battery.
 */

import { BATTLEFIELD_SIZE, SHIP_SIZES } from "../../config";
import {
  createControlState,
  startManeuver,
  type ShipControlState,
} from "../../core/ArcadeControls";
import type { ShipState } from "../../core/types";
import {
  getMovementProfile,
  getShipDefinition,
} from "../../data/ShipDefinitions";
import {
  performAction,
  stepMotion,
  type MotionAction,
  type MotionState,
} from "../../arcade/systems/ShipMotion";
import {
  torusDisplacement,
  type FlightStep,
  type Pose,
} from "./XWingFlightOracle";

/** The scene's fixed simulation step (ArcadeBattleScene.FIXED_DT). */
export const ARCADE_FIXED_TICK_MS = 1000 / 60;

/** One telemetry sample, in the unwrapped frame of reference. */
export interface TelemetrySample {
  readonly tMs: number;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/** Everything recorded while flying a plan. */
export interface FlightRecord {
  /** Base size used for this ship (px). */
  readonly baseSize: number;
  /** Unwrapped pose at the end of each cycle, in plan order. */
  readonly cyclePoses: Pose[];
  /** Simulation time at which each cycle completed (ms). */
  readonly cycleEndMs: number[];
  /** Every tick, unwrapped. */
  readonly samples: TelemetrySample[];
  /** Largest single-tick displacement observed (px) — teleport detector. */
  readonly maxTickJumpPx: number;
}

/** Options for {@link flyArcadeShip}. */
export interface FlightOptions {
  /** Start pose (default: battlefield centre, facing up). */
  readonly start?: Pose;
  /** Tick length; a function receives the tick index (default 60 Hz fixed). */
  readonly tickMs?: number | ((tick: number) => number);
  /** Flight actions (boost, barrel roll, Snap turn…) triggered at given times. */
  readonly actions?: ReadonlyArray<TimedAction>;
  /** Battlefield edge length (default BATTLEFIELD_SIZE). */
  readonly worldSize?: number;
}

/** A flight action fired at a simulation time. */
export interface TimedAction {
  readonly atMs: number;
  readonly action: MotionAction;
}

/** A flight action fired at a simulation time. */
export interface TimedAction {
  readonly atMs: number;
  readonly action: MotionAction;
}

/** Ticks after which a plan is declared stuck (no cycle ever completes). */
const MAX_TICKS = 20000;

/**
 * Build the ShipState the scene would spawn for a definition.
 * @param definitionId - Ship definition id.
 * @param pose - Spawn pose.
 * @returns A minimal ShipState.
 */
function spawnShip(definitionId: string, pose: Pose): ShipState {
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
 * @returns The ready control state and the base size used.
 */
function initialControl(
  ship: ShipState,
  first: FlightStep,
): { control: ShipControlState; baseSize: number } {
  const def = getShipDefinition(ship.definitionId);
  const baseSize = SHIP_SIZES[def?.baseStats.size ?? "small"] ?? 32;
  const created = createControlState(
    ship,
    baseSize,
    getMovementProfile(ship.definitionId),
    def?.baseStats.speed ?? { min: 1, max: 5 },
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
function queueStep(
  control: ShipControlState,
  next: FlightStep | undefined,
): ShipControlState {
  if (!next) return control;
  return { ...control, speed: next.speed, nextManeuver: next.direction };
}

/**
 * Fly a ship through a plan, one maneuver per cycle, and record telemetry.
 *
 * @param definitionId - Ship definition id.
 * @param plan - Maneuvers, one per cycle (must be non-empty).
 * @param options - Start pose, tick schedule, boosts, world size.
 * @returns The recorded flight.
 */
export function flyArcadeShip(
  definitionId: string,
  plan: ReadonlyArray<FlightStep>,
  options: FlightOptions = {},
): FlightRecord {
  const worldSize = options.worldSize ?? BATTLEFIELD_SIZE;
  const start = options.start ?? {
    x: worldSize / 2,
    y: worldSize / 2,
    angle: 0,
  };
  const tickOf = (i: number): number =>
    typeof options.tickMs === "function"
      ? options.tickMs(i)
      : (options.tickMs ?? ARCADE_FIXED_TICK_MS);
  const pending = [...(options.actions ?? [])].sort((a, b) => a.atMs - b.atMs);

  const ship = spawnShip(definitionId, start);
  const { control, baseSize } = initialControl(ship, plan[0]!);
  let state: MotionState = {
    x: start.x,
    y: start.y,
    angle: start.angle,
    control: queueStep(control, plan[1]),
  };
  let unwrapped = { x: start.x, y: start.y };
  let tMs = 0;
  let maxTickJumpPx = 0;
  const cyclePoses: Pose[] = [];
  const cycleEndMs: number[] = [];
  const samples: TelemetrySample[] = [];

  for (
    let tick = 0;
    cyclePoses.length < plan.length && tick < MAX_TICKS;
    tick++
  ) {
    const dt = tickOf(tick);
    const before = state;
    while (pending.length > 0 && pending[0]!.atMs <= tMs) {
      state = performAction(
        state,
        ship,
        pending.shift()!.action,
        worldSize,
      ).state;
    }
    const step = stepMotion(state, ship, dt, worldSize);
    state = step.state;
    tMs += dt;

    const move = torusDisplacement(before, state, worldSize);
    maxTickJumpPx = Math.max(maxTickJumpPx, Math.hypot(move.dx, move.dy));
    const unwrappedBefore = unwrapped;
    unwrapped = { x: unwrapped.x + move.dx, y: unwrapped.y + move.dy };
    samples.push({ tMs, x: unwrapped.x, y: unwrapped.y, angle: state.angle });

    if (step.completed) {
      const { endPose } = step.completed;
      const toEnd = torusDisplacement(before, endPose, worldSize);
      cyclePoses.push({
        x: unwrappedBefore.x + toEnd.dx,
        y: unwrappedBefore.y + toEnd.dy,
        angle: endPose.angle,
      });
      cycleEndMs.push(tMs - step.carriedMs);
      state = {
        ...state,
        control: queueStep(state.control, plan[cyclePoses.length + 1]),
      };
    }
  }

  return { baseSize, cyclePoses, cycleEndMs, samples, maxTickJumpPx };
}
