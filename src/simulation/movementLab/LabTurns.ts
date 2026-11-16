/**
 * LabTurns — turn quality of a pilot on one engine: the time, radius and
 * overshoot of a wanted heading change (a 180° U-turn, a 45° correction) and
 * the smoothness (heading acceleration, position jerk) of a slalom.
 *
 * Pure: no Phaser; fixed 60 Hz ticks, no randomness.
 */

import { BATTLEFIELD_SIZE } from "../../config";
import type { SteeringMode } from "../../core/steeringMode";
import {
  flyTrack,
  styledPilot,
  type LabConfig,
  type TrackSample,
} from "./LabMetrics";
import type { LabPilotKind } from "./LabPilot";
import { TICK_MS } from "./LabShip";

/** A turn counts as done within this many degrees of the wanted heading. */
const ARRIVED_WITHIN_DEG = 10;
/** How long a turn is flown (ms): the pilot has time to settle. */
const TURN_FLIGHT_MS = 4000;

/** Quality of one wanted heading change. */
export interface TurnResult {
  /** Time to come within 10° of the wanted heading (ms); Infinity = never. */
  readonly timeMs: number;
  /** Turn radius: chord / (2 sin(angle / 2)) at that moment (px). */
  readonly radiusPx: number;
  /** Most the heading went beyond the wanted one afterwards (°). */
  readonly overshootDeg: number;
  /** Barrel rolls the pilot's presses flew by accident. */
  readonly rolls: number;
}

/**
 * @param samples - A flown track.
 * @param wantedDeg - The wanted heading change (°).
 * @returns The time, radius and overshoot of the turn.
 */
function turnOf(samples: readonly TrackSample[], wantedDeg: number): Omit<TurnResult, "rolls"> {
  const arrived = samples.findIndex(
    (s) => Math.abs(wantedDeg - s.turnedDeg) <= ARRIVED_WITHIN_DEG,
  );
  if (arrived < 0)
    return { timeMs: Infinity, radiusPx: Infinity, overshootDeg: 0 };
  const at = samples[arrived]!;
  const chord = Math.hypot(at.x - samples[0]!.x, at.y - samples[0]!.y);
  const half = (Math.abs(at.turnedDeg) * Math.PI) / 360;
  const beyond = samples
    .slice(arrived)
    .map((s) => Math.sign(wantedDeg) * (s.turnedDeg - wantedDeg));
  return {
    timeMs: at.tMs,
    radiusPx: chord / (2 * Math.sin(half)),
    overshootDeg: Math.max(0, ...beyond),
  };
}

/**
 * @param engine - Steering engine.
 * @param kind - Pilot style.
 * @param config - Ship, throttle and rate scale.
 * @param wantedDeg - The heading change wanted (°, + = right).
 * @returns Time, radius and overshoot of the turn.
 */
export function measureTurn(
  engine: SteeringMode,
  kind: LabPilotKind,
  config: LabConfig,
  wantedDeg: number,
): TurnResult {
  const track = flyTrack(
    engine,
    config,
    styledPilot(engine, kind, () => wantedDeg),
    TURN_FLIGHT_MS,
  );
  return { ...turnOf(track.samples, wantedDeg), rolls: track.rolls };
}

/** Smoothness of a slalom. */
export interface SmoothnessResult {
  /** RMS of the heading's second derivative (°/s²). */
  readonly headingAccelRms: number;
  /** RMS of the position's third derivative (px/s³). */
  readonly positionJerkRms: number;
}

const SLALOM_MS = 12000;
const SLALOM_LEG_MS = 1500;
const SLALOM_SWING_DEG = 60;

/**
 * @param delta - A coordinate difference between two ticks (px).
 * @returns The difference across the torus seam (px).
 */
function unwrapped(delta: number): number {
  const half = BATTLEFIELD_SIZE / 2;
  return delta > half ? delta - BATTLEFIELD_SIZE : delta < -half ? delta + BATTLEFIELD_SIZE : delta;
}

/**
 * @param values - Samples at 60 Hz.
 * @param order - Derivative order (1-3).
 * @returns The finite-difference derivative per second^order.
 */
function derivative(values: readonly number[], order: number): number[] {
  let current = [...values];
  for (let k = 0; k < order; k++)
    current = current.slice(1).map((v, i) => (v - current[i]!) / (TICK_MS / 1000));
  return current;
}

/**
 * @param values - A series.
 * @returns Its root mean square.
 */
function rms(values: readonly number[]): number {
  return Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length);
}

/**
 * A slalom: the wanted heading swings ±60° every 1.5 s for 12 s.
 *
 * @param engine - Steering engine.
 * @param kind - Pilot style.
 * @param config - Ship, throttle and rate scale.
 * @returns Heading acceleration and position jerk, RMS.
 */
export function measureSmoothness(
  engine: SteeringMode,
  kind: LabPilotKind,
  config: LabConfig,
): SmoothnessResult {
  const wanted = (tMs: number): number =>
    Math.floor(tMs / SLALOM_LEG_MS) % 2 === 0 ? SLALOM_SWING_DEG : -SLALOM_SWING_DEG;
  const { samples } = flyTrack(engine, config, styledPilot(engine, kind, wanted), SLALOM_MS);
  const path = (axis: "x" | "y"): number[] => {
    let sum = 0;
    return samples.map((s, i) => {
      if (i > 0) sum += unwrapped(s[axis] - samples[i - 1]![axis]);
      return sum;
    });
  };
  const [jx, jy] = [derivative(path("x"), 3), derivative(path("y"), 3)];
  return {
    headingAccelRms: rms(derivative(samples.map((s) => s.turnedDeg), 2)),
    positionJerkRms: rms(jx.map((v, i) => Math.hypot(v, jy[i]!))),
  };
}
