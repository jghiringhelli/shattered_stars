/**
 * BehaviourProfile — what the BehaviourProfiler records per ship (raw sums),
 * the thresholds that define each behaviour, and the builders for both.
 *
 * Pure: no Phaser.
 */

import { torusOffset } from "../../arcade/ai/AiGeometry";
import type { ArenaShip } from "./ArenaShip";

/** Sampling period of the slow metrics (turn rate, closing speed, bearing) (ms). */
export const SAMPLE_MS = 250;

/** Turn rate above which the ship counts as turning (°/s). */
export const TURNING_DEG_PER_SECOND = 20;

/** Closing / opening speed above which the range is changing (px/s). */
export const RANGE_RATE_PX_PER_SECOND = 20;

/** Opposite turns this close together are a heading reversal (ms). */
export const REVERSAL_WINDOW_MS = 3000;

/** Cumulative bearing change around one target that counts as an orbit (°). */
export const ORBIT_DEG = 360;

/** Within this many px of the map edge a manoeuvre happens "at the seam". */
export const SEAM_MARGIN_PX = 150;

/** Idle flight: target this far off the nose, beyond the arc half-width (°). */
export const IDLE_MARGIN_DEG = 15;

/** Allies closer than this are stacked on each other (px). */
export const STACK_PX = 40;

/** This many hard turns in a row are a spin (cycles). */
export const SPIN_CYCLES = 6;

/** The decisions a pilot took, counted by the recording bot. */
export interface DecisionCounts {
  decisions: number;
  specialRequests: number;
  specialRequestsWhileStressed: number;
  boostRequests: number;
  rollRequests: number;
}

/** @returns Zeroed decision counts. */
export function emptyDecisions(): DecisionCounts {
  return {
    decisions: 0,
    specialRequests: 0,
    specialRequestsWhileStressed: 0,
    boostRequests: 0,
    rollRequests: 0,
  };
}

/** Raw sums of one ship's flight. */
export interface ShipProfile {
  readonly id: string;
  readonly definitionId: string;
  readonly side: string;
  readonly decisions: DecisionCounts;
  aliveMs: number;
  inArcAndRangeMs: number;
  inArcMs: number;
  inRangeMs: number;
  inTargetRearMs: number;
  closingMs: number;
  openingMs: number;
  closingPxSum: number;
  rangeSamples: number;
  shots: number;
  firstShotMs: number | null;
  turnSamples: number;
  reversals: number;
  reversalsNearSeam: number;
  orbits: number;
  throttleChanges: number;
  stressedMs: number;
  stressSum: number;
  runningMs: number;
  idleInRangeMs: number;
  seamCrossings: number;
  cappedMs: number;
  /** Time within {@link STACK_PX} of an ally (ships stacked on each other). */
  stackedMs: number;
  /** Sum over ticks of the distance to the nearest ally (px x ms). */
  allyDistanceSum: number;
  allyMs: number;
  cycles: number;
  /** Cycles whose committed maneuver is the one the pilot's intent asked for. */
  asPlanned: number;
  /** Cycles started with a throttle the intent did not ask for. */
  offThrottle: number;
  turnCycles: number;
  /** Runs of {@link SPIN_CYCLES}+ hard turns in a row (spinning on the spot). */
  spinRuns: number;
  /** Sum over cycles of set throttle / top throttle. */
  throttleShareSum: number;
  specialsFlown: Record<"kturn" | "segnor" | "tallon", number>;
}

/** Per-ship memory between ticks. */
export interface ShipMemory {
  lastSampleMs: number;
  lastAngle: number;
  lastDistances: Map<string, number>;
  lastTurnSign: number;
  lastTurnMs: number;
  lastSpeed: number;
  lastCooldown: number;
  lastX: number;
  lastY: number;
  orbitTarget: string | null;
  lastBearing: number | null;
  orbitDeg: number;
  closing: boolean;
  running: boolean;
  turnStreak: number;
}

/** The enemy a pilot is working on: its chosen target, else the nearest. */
export function pickTarget(
  ship: ArenaShip,
  enemies: readonly ArenaShip[],
  worldSize: number,
): ArenaShip | null {
  const chosen = enemies.find((e) => e.id === ship.pilot.targetId);
  if (chosen) return chosen;
  let best: ArenaShip | null = null;
  let bestDistance = Infinity;
  for (const enemy of enemies) {
    const distance = torusOffset(ship, enemy, worldSize).distance;
    if (distance >= bestDistance) continue;
    best = enemy;
    bestDistance = distance;
  }
  return best;
}

export function newProfile(
  ship: ArenaShip,
  decisions?: DecisionCounts,
): ShipProfile {
  return {
    id: ship.id,
    definitionId: ship.definitionId,
    side: ship.side,
    decisions: { ...(decisions ?? emptyDecisions()) },
    aliveMs: 0,
    inArcAndRangeMs: 0,
    inArcMs: 0,
    inRangeMs: 0,
    inTargetRearMs: 0,
    closingMs: 0,
    openingMs: 0,
    closingPxSum: 0,
    rangeSamples: 0,
    shots: 0,
    firstShotMs: null,
    turnSamples: 0,
    reversals: 0,
    reversalsNearSeam: 0,
    orbits: 0,
    throttleChanges: 0,
    stressedMs: 0,
    stressSum: 0,
    runningMs: 0,
    idleInRangeMs: 0,
    seamCrossings: 0,
    cappedMs: 0,
    stackedMs: 0,
    allyDistanceSum: 0,
    allyMs: 0,
    cycles: 0,
    asPlanned: 0,
    offThrottle: 0,
    turnCycles: 0,
    spinRuns: 0,
    throttleShareSum: 0,
    specialsFlown: { kturn: 0, segnor: 0, tallon: 0 },
  };
}
