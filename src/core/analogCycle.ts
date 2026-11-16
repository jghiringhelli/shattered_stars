/**
 * analogCycle — the analog turn key inside the 500 ms cycle.
 *
 * The cycle stays (speed changes, stress, weapons, bots and online all key on
 * it) but a free-steer cycle is not a template: the turn key bends the heading
 * every tick (`updateAnalogCycle`), at once, with no cycle cut. Atomic
 * specials (Snap Turn, Hook Loop, Knife Roll) and queued template maneuvers
 * still fly their templates; the key is remembered through them.
 *
 * Generic over the control state so src/core/ArcadeControls can start cycles
 * without an import cycle. Pure and serialisable.
 */

import { CYCLE_DURATION_MS } from "../config";
import {
  flyAnalogLeg,
  freshAnalogSteer,
  steeringCapacity,
  usesAnalogSteering,
  type AnalogControlView,
  type AnalogLeg,
  type AnalogSide,
  type AnalogSteer,
} from "./analogSteering";
import type { ManeuverDirection } from "./types";

/**
 * Floating-point slack when deciding a cycle is complete (ms): 30 ticks of
 * 1000/60 ms sum to 499.99999….
 */
const CYCLE_EPSILON_MS = 1e-6;

/** A ship's pose. */
interface Pose {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/** Result of one analog tick, shaped like ArcadeControls.updateManeuver's. */
export interface AnalogAdvance<C> {
  readonly control: C;
  readonly position: { x: number; y: number; angle: number };
  readonly cycleComplete: boolean;
  /** Time left over after the cycle completed, owed to the next cycle (ms). */
  readonly overflowMs: number;
}

/**
 * @param control - A control state.
 * @returns Whether a free-steer cycle is flying (the analog integrator moves the ship).
 */
export function isFreeSteerCycle(control: AnalogControlView): boolean {
  return control.analog?.free === true;
}

/**
 * Prepare the analog state of a cycle that has just been started by the
 * template engine (it has set `cycleSpeed` and the template target). A
 * straight cycle becomes free-steer; any other maneuver stays a template.
 * The key held through the boundary keeps turning.
 *
 * @param pose - Pose at the start of the cycle.
 * @param control - Control state just returned by startManeuver.
 * @param direction - The maneuver the cycle flies.
 * @returns The control with its analog state (unchanged when not analog).
 */
export function beginAnalogCycle<C extends AnalogControlView>(
  pose: Pose,
  control: C,
  direction: ManeuverDirection,
): C {
  if (!usesAnalogSteering(control)) return control;
  const free = direction === "straight";
  const analog = freshAnalogSteer(control.cycleSpeed, free, control.analog);
  if (!free || analog.held === "none") return { ...control, analog };
  // The key held through the boundary plans the new cycle afresh.
  const idle = { ...control, analog: { ...analog, held: "none" as const } };
  return applyHold(pose, idle, analog.held, analog.stressed);
}

/**
 * The pilot's turn key this tick. Changes the speed and rate at once; a
 * template cycle only remembers the key.
 *
 * @param pose - The ship's pose now.
 * @param control - Control state.
 * @param side - Key held (none = released).
 * @param stressed - Whether the pilot is stressed.
 * @returns The control (the same object when nothing changed).
 */
export function holdSteer<C extends AnalogControlView>(
  pose: Pose,
  control: C,
  side: AnalogSide,
  stressed: boolean,
): C {
  const analog = control.analog;
  if (!analog) return control;
  if (!analog.free)
    return analog.held === side && analog.stressed === stressed
      ? control
      : { ...control, analog: { ...analog, held: side, stressed } };
  return applyHold(pose, control, side, stressed);
}

/**
 * @param pose - The ship's pose now.
 * @param control - Control state of a free-steer cycle.
 * @param side - Key held.
 * @param stressed - Whether the pilot is stressed.
 * @returns The control with speed, rate, label and predicted end updated.
 */
function applyHold<C extends AnalogControlView>(
  pose: Pose,
  control: C,
  side: AnalogSide,
  stressed: boolean,
): C {
  const analog = control.analog!;
  // A throttle tap while the key is down does not change the cycle in flight
  // (speed changes commit at the boundary); a new press or cycle plans afresh.
  if (analog.held === side && analog.stressed === stressed) return control;
  const capacity =
    side === "none"
      ? null
      : steeringCapacity(
          control.capabilities?.dialSpeeds,
          control.speed,
          stressed,
          control.capabilities?.analogRateScale,
        );
  const rateDeg = capacity?.rateDeg ?? 0;
  const speed = capacity?.speed ?? analog.baseSpeed;
  const next: AnalogSteer = {
    ...analog,
    held: side,
    stressed,
    rateDeg,
    ...(capacity
      ? {
          turnSpeed: capacity.speed,
          dialMaxDeg: capacity.dialMaxDeg,
          turnKind: capacity.kind,
        }
      : {}),
  };
  const held = { ...control, cycleSpeed: speed, analog: next };
  return {
    ...held,
    currentManeuver: liveManeuver(next),
    maneuverTarget: predictAnalogEnd(pose, held),
  };
}

/**
 * The maneuver the cycle looks like right now (HUD labels): the dial entry the
 * held key flies, else what the turn so far amounts to.
 *
 * @param analog - Steering state.
 * @returns A dial maneuver of the held side (straight when not turning).
 */
export function liveManeuver(analog: AnalogSteer): ManeuverDirection {
  const turning = analog.held !== "none" && analog.rateDeg > 0;
  if (!turning && analog.turnedDeg <= 0) return "straight";
  const side = analog.held === "right" ? "right" : "left";
  return analog.turnKind === "turn" && (turning || analog.turnedDeg >= 0.65 * analog.dialMaxDeg)
    ? `turn_${side}`
    : `bank_${side}`;
}

/**
 * Where the cycle ends if the key keeps its present state: held until the end
 * of the cycle, or (with `holdLeftMs`) released after that many more ms.
 *
 * @param pose - The ship's pose now.
 * @param control - Control state of a free-steer cycle.
 * @param holdLeftMs - Time the key will still be held; omitted = to the end.
 * @returns The predicted pose at the cycle boundary.
 */
export function predictAnalogEnd(
  pose: Pose,
  control: AnalogControlView,
  holdLeftMs: number = Number.POSITIVE_INFINITY,
): { x: number; y: number; angle: number } {
  const analog = control.analog;
  const remaining = Math.max(
    0,
    CYCLE_DURATION_MS - control.maneuverProgress * CYCLE_DURATION_MS,
  );
  if (!analog || analog.held === "none" || analog.rateDeg <= 0)
    return flyAnalogLeg(pose, legOf(control, 0, "none", remaining));
  const turning = Math.min(remaining, Math.max(0, holdLeftMs));
  const arc = flyAnalogLeg(
    pose,
    legOf(control, analog.rateDeg, analog.held, turning),
  );
  return flyAnalogLeg(arc, {
    ...legOf(control, 0, "none", remaining - turning),
    speed: analog.baseSpeed,
  });
}

/**
 * @param control - Control state.
 * @param rateDeg - Turn rate (°/cycle).
 * @param side - Turn side.
 * @param durationMs - Leg length.
 * @returns A leg at the cycle's current speed.
 */
function legOf(
  control: AnalogControlView,
  rateDeg: number,
  side: AnalogSide,
  durationMs: number,
): AnalogLeg {
  return {
    speed: control.cycleSpeed,
    baseSize: control.baseSize,
    rateDeg,
    side,
    durationMs,
  };
}

/**
 * Advance a free-steer cycle by one tick: the heading bends while the key is
 * held, the ship moves along the arc (or straight), and the cycle completes
 * at 500 ms exactly like a template cycle.
 *
 * @param pose - The ship's pose.
 * @param control - Control state of a free-steer cycle.
 * @param deltaMs - Elapsed tick time (ms).
 * @returns The same shape as ArcadeControls.updateManeuver.
 */
export function updateAnalogCycle<C extends AnalogControlView>(
  pose: Pose,
  control: C,
  deltaMs: number,
): AnalogAdvance<C> {
  const analog = control.analog!;
  const startMs = control.maneuverProgress * CYCLE_DURATION_MS;
  const elapsedMs = startMs + deltaMs;
  const complete = elapsedMs >= CYCLE_DURATION_MS - CYCLE_EPSILON_MS;
  const stepMs = complete ? Math.max(0, CYCLE_DURATION_MS - startMs) : deltaMs;
  const turning = analog.held !== "none" && analog.rateDeg > 0;
  const position = flyAnalogLeg(
    pose,
    legOf(control, turning ? analog.rateDeg : 0, analog.held, stepMs),
  );
  const next: AnalogSteer = turning
    ? {
        ...analog,
        turnedDeg: analog.turnedDeg + (analog.rateDeg * stepMs) / CYCLE_DURATION_MS,
      }
    : analog;
  return {
    control: {
      ...control,
      maneuverProgress: complete ? 1 : elapsedMs / CYCLE_DURATION_MS,
      analog: next,
      currentManeuver: liveManeuver(next),
    },
    position,
    cycleComplete: complete,
    overflowMs: complete ? Math.max(0, elapsedMs - CYCLE_DURATION_MS) : 0,
  };
}
