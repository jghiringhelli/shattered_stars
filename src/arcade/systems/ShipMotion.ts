/**
 * ShipMotion — the per-tick kinematic step of an arcade ship.
 *
 * This is the movement half of ArcadeBattleScene.updateShips, extracted so the
 * scene and the headless flight-telemetry battery run the SAME code: advance
 * the current maneuver along its template path, commit the queued maneuver at
 * each cycle boundary, and wrap the ship onto the toroidal battlefield.
 *
 * Instant actions (boost, barrel roll, specials) live in ShipActions.
 *
 * Pure: no Phaser. Stress, capital-system damage and rendering stay in the
 * scene, which reads {@link MotionStep.completed} to classify the finished cycle.
 */

import {
  advanceCycle,
  updateManeuver,
  type ShipControlState,
  type ShipPose,
} from "../../core/ArcadeControls";
import { canInterruptCycle, interruptCycle } from "../../core/cycleInterrupt";
import { SPEED_SCALE_FACTOR } from "../../config";
import type { ManeuverDirection } from "../../core/types";

/** Where a ship is and what it is flying. */
export interface MotionState {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly control: ShipControlState;
}

/** The maneuver a ship just finished (or was cut out of), for stress classification. */
export interface CompletedCycle {
  readonly direction: ManeuverDirection;
  /** The speed it was flown at (the dial cap applied), not the set throttle. */
  readonly speed: number;
  /**
   * Share of the cycle that was flown: 1 for a cycle that ran to its
   * boundary, less when a human's turn cut it short (src/core/cycleInterrupt).
   * Scales the cycle's stress so a cut cycle never double-counts.
   */
  readonly fraction: number;
  /** Exact pose at the end of the cycle (wrapped), before any carried time. */
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
 * A pose on the battlefield: wrapped, heading kept.
 * @param pose - Any pose.
 * @param worldSize - Battlefield edge length in px.
 * @returns The wrapped pose.
 */
function wrappedPose(pose: ShipPose, worldSize: number): ShipPose {
  return {
    x: wrapCoordinate(pose.x, worldSize),
    y: wrapCoordinate(pose.y, worldSize),
    angle: pose.angle,
  };
}

/**
 * A human's queued turn cuts the running cycle at the ship's current pose
 * (src/core/cycleInterrupt); every other ship keeps flying its cycle.
 *
 * @param state - Motion state before the tick.
 * @param worldSize - Battlefield edge length in px.
 * @returns The control to advance this tick and the cut cycle, if any.
 */
function cutCycleIfRequested(
  state: MotionState,
  worldSize: number,
): { control: ShipControlState; completed: CompletedCycle | null } {
  const { control } = state;
  if (!canInterruptCycle(control)) return { control, completed: null };
  const cut = interruptCycle(state, control);
  return {
    control: cut.control,
    completed: {
      direction: control.currentManeuver ?? "straight",
      speed: control.cycleSpeed,
      fraction: cut.fraction,
      endPose: wrappedPose(state, worldSize),
    },
  };
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
  const cut = cutCycleIfRequested(state, worldSize);
  const moved = updateManeuver(cut.control, deltaMs);
  const at = {
    x: moved.position?.x ?? state.x,
    y: moved.position?.y ?? state.y,
    angle: moved.position?.angle ?? state.angle,
  };
  if (!moved.cycleComplete) {
    return {
      state: { ...wrappedPose(at, worldSize), control: moved.control },
      completed: cut.completed,
      carriedMs: 0,
    };
  }
  const completed: CompletedCycle = {
    direction: moved.control.currentManeuver ?? "straight",
    speed: moved.control.cycleSpeed,
    fraction: 1,
    endPose: wrappedPose(at, worldSize),
  };
  const next = advanceCycle({ ...ship, ...at }, moved.control);
  // Time past the cycle boundary belongs to the next cycle, so cycles
  // stay exactly CYCLE_DURATION_MS long whatever the tick length.
  const carried =
    moved.overflowMs > 0 ? updateManeuver(next, moved.overflowMs) : null;
  const end = {
    x: carried?.position?.x ?? at.x,
    y: carried?.position?.y ?? at.y,
    angle: carried?.position?.angle ?? at.angle,
  };
  return {
    state: {
      ...wrappedPose(end, worldSize),
      control: carried?.control ?? next,
    },
    completed,
    carriedMs: moved.overflowMs,
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

/** Speed of the template a barrel roll slides along (a speed-2 template). */
export const BARREL_ROLL_TEMPLATE_SPEED = 2;

/**
 * Barrel-roll slide: one speed-2 template plus the ship's base, sideways.
 * @param baseSize - Ship base size in px.
 * @returns Slide length in px.
 */
export function barrelRollDistance(baseSize: number): number {
  return BARREL_ROLL_TEMPLATE_SPEED * SPEED_SCALE_FACTOR + baseSize;
}
