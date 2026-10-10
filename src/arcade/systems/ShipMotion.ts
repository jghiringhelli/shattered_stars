/**
 * ShipMotion — the per-tick kinematic step of an arcade ship.
 *
 * This is the movement half of ArcadeBattleScene.updateShips, extracted so the
 * scene and the headless flight-telemetry battery run the SAME code: advance
 * the current maneuver along its template path, commit the queued maneuver at
 * each cycle boundary, and wrap the ship onto the toroidal battlefield.
 *
 * Pure: no Phaser. Stress, capital-system damage and rendering stay in the
 * scene, which reads {@link MotionStep.completed} to classify the finished cycle.
 */

import {
  advanceCycle,
  canBarrelRoll,
  canBoost,
  processCommand,
  updateManeuver,
  useBarrelRoll,
  useBoost,
  type ShipControlState,
  type ShipPose,
} from "../../core/ArcadeControls";
import { SPEED_SCALE_FACTOR } from "../../config";
import type { ManeuverDirection } from "../../core/types";
import { BOOST_DISTANCE_PX } from "../ArcadeInputGestures";

/** Where a ship is and what it is flying. */
export interface MotionState {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly control: ShipControlState;
}

/** The maneuver a ship just finished, for stress classification. */
export interface CompletedCycle {
  readonly direction: ManeuverDirection;
  readonly speed: number;
  /** Exact pose at the cycle boundary (wrapped), before any carried time. */
  readonly endPose: {
    readonly x: number;
    readonly y: number;
    readonly angle: number;
  };
}

/** Result of one motion tick. */
export interface MotionStep {
  readonly state: MotionState;
  /** Set on the tick a maneuver cycle completed, otherwise null. */
  readonly completed: CompletedCycle | null;
  /** Tick time spent on the next cycle after the boundary (ms). */
  readonly carriedMs: number;
}

/**
 * Wrap a coordinate onto a toroidal battlefield.
 * @param value - Coordinate in px.
 * @param worldSize - Battlefield edge length in px.
 * @returns The coordinate in [0, worldSize).
 */
export function wrapCoordinate(value: number, worldSize: number): number {
  return ((value % worldSize) + worldSize) % worldSize;
}

/**
 * Advance a ship's motion by one simulation tick.
 *
 * @param state - Position, heading and control state before the tick.
 * @param ship - The ship (identity fields; position is taken from `state`).
 * @param deltaMs - Tick length in ms.
 * @param worldSize - Battlefield edge length in px (toroidal wrap).
 * @returns The new motion state and the cycle that completed, if any.
 */
export function stepMotion(
  state: MotionState,
  ship: ShipPose,
  deltaMs: number,
  worldSize: number,
): MotionStep {
  const { control, position, cycleComplete, overflowMs } = updateManeuver(
    state.control,
    deltaMs,
  );
  let x = position?.x ?? state.x;
  let y = position?.y ?? state.y;
  let angle = position?.angle ?? state.angle;
  let nextControl = control;
  let completed: CompletedCycle | null = null;

  if (cycleComplete) {
    completed = {
      direction: control.currentManeuver ?? "straight",
      speed: control.speed,
      endPose: {
        x: wrapCoordinate(x, worldSize),
        y: wrapCoordinate(y, worldSize),
        angle,
      },
    };
    nextControl = advanceCycle({ ...ship, x, y, angle }, control);
    // Time past the cycle boundary belongs to the next cycle, so cycles
    // stay exactly CYCLE_DURATION_MS long whatever the tick length.
    if (overflowMs > 0) {
      const carried = updateManeuver(nextControl, overflowMs);
      nextControl = carried.control;
      x = carried.position?.x ?? x;
      y = carried.position?.y ?? y;
      angle = carried.position?.angle ?? angle;
    }
  }

  x = wrapCoordinate(x, worldSize);
  y = wrapCoordinate(y, worldSize);
  return {
    state: { x, y, angle, control: nextControl },
    completed,
    carriedMs: cycleComplete ? overflowMs : 0,
  };
}

/**
 * Displace a ship mid-cycle. The maneuver in progress is carried along: its
 * remaining path and its end point move by the same vector, so the cycle
 * finishes from where the ship now is instead of snapping back onto the old
 * template on the next tick.
 *
 * @param state - Motion state before the displacement.
 * @param dx - Horizontal displacement (px).
 * @param dy - Vertical displacement (px).
 * @param worldSize - Battlefield edge length in px.
 * @returns The displaced motion state.
 */
export function shiftMotion(
  state: MotionState,
  dx: number,
  dy: number,
  worldSize: number,
): MotionState {
  const { control } = state;
  const target = control.maneuverTarget;
  return {
    ...state,
    x: wrapCoordinate(state.x + dx, worldSize),
    y: wrapCoordinate(state.y + dy, worldSize),
    control: {
      ...control,
      maneuverPath: control.maneuverPath.map((p) => ({
        ...p,
        x: p.x + dx,
        y: p.y + dy,
      })),
      maneuverTarget: target
        ? { ...target, x: target.x + dx, y: target.y + dy }
        : null,
    },
  };
}

/**
 * Displace a ship along a direction relative to its heading.
 * @param state - Motion state before the dash.
 * @param relativeDeg - Direction relative to the heading (0 = ahead, +90 = right).
 * @param distancePx - Dash length in px.
 * @param worldSize - Battlefield edge length in px.
 * @returns The displaced motion state.
 */
function dash(
  state: MotionState,
  relativeDeg: number,
  distancePx: number,
  worldSize: number,
): MotionState {
  const rad = ((state.angle + relativeDeg) * Math.PI) / 180;
  return shiftMotion(
    state,
    Math.sin(rad) * distancePx,
    -Math.cos(rad) * distancePx,
    worldSize,
  );
}

/**
 * Barrel-roll slide: one speed-1 template plus the ship's base, sideways.
 * @param baseSize - Ship base size in px.
 * @returns Slide length in px (X-Wing 2.0 barrel roll).
 */
export function barrelRollDistance(baseSize: number): number {
  return SPEED_SCALE_FACTOR + baseSize;
}

/** Instant flight actions a pilot (or the AI) can trigger mid-cycle. */
export type MotionAction =
  | "boost"
  | "barrel_roll_left"
  | "barrel_roll_right"
  | "kturn"
  | "segnor_left"
  | "segnor_right"
  | "tallon_left"
  | "tallon_right";

/** Result of attempting an action. */
export interface ActionResult {
  readonly state: MotionState;
  /** False when the action was refused (on cooldown). */
  readonly performed: boolean;
}

/**
 * Perform a flight action — the single path the scene, the AI and the flight
 * battery all use. Cooldowns gate every action; stress is the caller's job.
 *
 * - Boost: dash forward BOOST_DISTANCE_PX, heading unchanged.
 * - Barrel roll: slide sideways one speed-1 template + base, heading unchanged.
 * - K-turn / Segnor / Tallon: queue the special maneuver for the next cycle.
 *
 * @param state - Motion state when the action fires.
 * @param ship - The ship (identity fields).
 * @param action - The action requested.
 * @param worldSize - Battlefield edge length in px.
 * @returns The new motion state and whether the action happened.
 */
export function performAction(
  state: MotionState,
  ship: ShipPose,
  action: MotionAction,
  worldSize: number,
): ActionResult {
  const { control } = state;
  if (action === "boost") {
    if (!canBoost(control)) return { state, performed: false };
    const boosted = dash(state, 0, BOOST_DISTANCE_PX, worldSize);
    return {
      state: { ...boosted, control: useBoost(boosted.control) },
      performed: true,
    };
  }
  if (action === "barrel_roll_left" || action === "barrel_roll_right") {
    if (!canBarrelRoll(control)) return { state, performed: false };
    const side = action === "barrel_roll_left" ? -90 : 90;
    const rolled = dash(
      state,
      side,
      barrelRollDistance(control.baseSize),
      worldSize,
    );
    return {
      state: { ...rolled, control: useBarrelRoll(rolled.control) },
      performed: true,
    };
  }
  const queued = processCommand(
    { ...ship, x: state.x, y: state.y, angle: state.angle },
    control,
    action,
  );
  return {
    state: { ...state, control: queued },
    performed: queued !== control,
  };
}
