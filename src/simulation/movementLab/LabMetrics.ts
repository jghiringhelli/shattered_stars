/**
 * LabMetrics — the measurements the movement lab takes of one steering
 * engine: how fast a key press becomes a heading change, how constant the
 * turn rate is, how long and wide a 180° takes and whether it overshoots,
 * and how smooth a slalom is.
 *
 * Pure: no Phaser; fixed 60 Hz ticks, no randomness.
 */

import type { SteeringMode } from "../../core/steeringMode";
import type { AnalogTuning } from "../../core/analogTuning";
import { headingDelta } from "../flight/XWingFlightOracle";
import { createLabPilot, type LabPilotKind, type LabPilotView } from "./LabPilot";
import {
  createLabShip,
  NO_KEYS,
  stepLabShip,
  TICK_MS,
  type LabKeys,
  type LabShip,
  type LabShipSetup,
} from "./LabShip";

/** The ship, throttle and analog tuning a measurement flies. */
export interface LabConfig {
  readonly definitionId: string;
  readonly speed: number;
  readonly tuning?: AnalogTuning;
}

const ORIGIN = { x: 3000, y: 3000, angle: 0 };

/**
 * @param engine - Steering engine.
 * @param config - Ship, throttle and rate scale.
 * @returns The ship setup of a measurement.
 */
export function setupOf(engine: SteeringMode, config: LabConfig): LabShipSetup {
  return {
    definitionId: config.definitionId,
    pose: ORIGIN,
    steering: engine,
    speed: config.speed,
    ...(config.tuning ? { tuning: config.tuning } : {}),
  };
}

/** One tick of a flown track. */
export interface TrackSample {
  readonly tMs: number;
  readonly x: number;
  readonly y: number;
  /** Heading turned since the start, unwrapped (°, + = right). */
  readonly turnedDeg: number;
}

/** A flown track and what the pilot's keys did. */
export interface Track {
  readonly samples: readonly TrackSample[];
  readonly rolls: number;
}

/** What a pilot does over a track: the keys it presses and the heading it wants. */
export interface TrackPilot {
  readonly keys: (view: LabPilotView) => LabKeys;
  /** Wanted heading change since the start (°) at a time (ms). */
  readonly targetTurnedDeg: (tMs: number) => number;
}

/**
 * @param engine - Steering engine.
 * @param kind - Pilot style.
 * @param targetTurnedDeg - Wanted heading change over time.
 * @returns The lab pilot of that style as a track pilot.
 */
export function styledPilot(
  engine: SteeringMode,
  kind: LabPilotKind,
  targetTurnedDeg: TrackPilot["targetTurnedDeg"],
): TrackPilot {
  return { keys: createLabPilot(kind, engine), targetTurnedDeg };
}

/**
 * Fly a pilot towards a wanted heading for a while.
 *
 * @param engine - Steering engine.
 * @param config - Ship, throttle and rate scale.
 * @param pilot - The keys it presses and the heading it wants over time.
 * @param durationMs - Length of the flight.
 * @returns One sample per tick.
 */
export function flyTrack(
  engine: SteeringMode,
  config: LabConfig,
  pilot: TrackPilot,
  durationMs: number,
): Track {
  let ship = createLabShip(setupOf(engine, config));
  const samples: TrackSample[] = [];
  let turnedDeg = 0;
  let angle = ship.flight.motion.angle;
  const ticks = Math.round(durationMs / TICK_MS);
  for (let tick = 0; tick < ticks; tick++) {
    const tMs = tick * TICK_MS;
    const { motion } = ship.flight;
    const keys = pilot.keys({
      errorDeg: pilot.targetTurnedDeg(tMs) - turnedDeg,
      tick,
      currentManeuver: motion.control.currentManeuver,
      nextManeuver: motion.control.nextManeuver,
    });
    ship = stepLabShip(ship, keys, tMs);
    const next = ship.flight.motion;
    turnedDeg += headingDelta(next.angle, angle);
    angle = next.angle;
    samples.push({ tMs: tMs + TICK_MS, x: next.x, y: next.y, turnedDeg });
  }
  return { samples, rolls: ship.rolls };
}

/** How quickly a held key turns into a heading change. */
export interface LatencyResult {
  /** Mean time from the press to a 1° heading change over cycle phases (ms). */
  readonly meanMs1Deg: number;
  readonly worstMs1Deg: number;
  readonly meanMs5Deg: number;
}

/**
 * @param ship - A ship.
 * @param ticks - Ticks to fly with no key.
 * @returns The ship after flying straight.
 */
function flyIdle(ship: LabShip, ticks: number): LabShip {
  let flown = ship;
  for (let tick = 0; tick < ticks; tick++)
    flown = stepLabShip(flown, NO_KEYS, tick * TICK_MS);
  return flown;
}

/**
 * @param ship - A ship cruising straight.
 * @param thresholdsDeg - Heading changes to time (ascending).
 * @returns Ms from pressing the right arrow to each heading change.
 */
function timeToTurn(ship: LabShip, thresholdsDeg: readonly number[]): number[] {
  const held: LabKeys = { ...NO_KEYS, right: true };
  const start = ship.flight.motion.angle;
  const times: number[] = [];
  let flown = ship;
  for (let tick = 0; tick < 90 && times.length < thresholdsDeg.length; tick++) {
    flown = stepLabShip(flown, held, tick * TICK_MS);
    const turned = Math.abs(headingDelta(flown.flight.motion.angle, start));
    if (turned >= thresholdsDeg[times.length]!) times.push((tick + 1) * TICK_MS);
  }
  return thresholdsDeg.map((_, i) => times[i] ?? Number.POSITIVE_INFINITY);
}

/**
 * Press the arrow at six phases of the 500 ms cycle and time the heading.
 *
 * @param engine - Steering engine.
 * @param config - Ship, throttle and rate scale.
 * @returns Mean and worst latency.
 */
export function measureLatency(
  engine: SteeringMode,
  config: LabConfig,
): LatencyResult {
  const phases = [0, 5, 10, 15, 20, 25];
  const times = phases.map((phase) =>
    timeToTurn(flyIdle(createLabShip(setupOf(engine, config)), phase), [1, 5]),
  );
  const ones = times.map(([one]) => one!);
  const fives = times.map(([, five]) => five!);
  const mean = (values: readonly number[]): number =>
    values.reduce((sum, v) => sum + v, 0) / values.length;
  return {
    meanMs1Deg: mean(ones),
    worstMs1Deg: Math.max(...ones),
    meanMs5Deg: mean(fives),
  };
}

/** How steady the turn rate is while the key is held. */
export interface ConstancyResult {
  readonly meanDegPerSec: number;
  /** Standard deviation over mean of the per-tick turn rate (0 = perfectly steady). */
  readonly variation: number;
}

/**
 * Hold the arrow for two seconds and look at the per-tick turn rate after
 * the first quarter second.
 *
 * @param engine - Steering engine.
 * @param config - Ship, throttle and rate scale.
 * @returns Mean turn rate and its variation.
 */
export function measureConstancy(
  engine: SteeringMode,
  config: LabConfig,
): ConstancyResult {
  const track = flyTrack(
    engine,
    config,
    { keys: () => ({ ...NO_KEYS, right: true }), targetTurnedDeg: () => 0 },
    2000,
  );
  const rates: number[] = [];
  track.samples.forEach((sample, i) => {
    const before = track.samples[i - 1];
    if (before && sample.tMs >= 250)
      rates.push(((sample.turnedDeg - before.turnedDeg) / TICK_MS) * 1000);
  });
  const mean = rates.reduce((sum, r) => sum + r, 0) / rates.length;
  const variance =
    rates.reduce((sum, r) => sum + (r - mean) ** 2, 0) / rates.length;
  return { meanDegPerSec: mean, variation: Math.sqrt(variance) / mean };
}
