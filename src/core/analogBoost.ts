/**
 * analogBoost — the "held key flies the hard turn" variant of the analog
 * engine (src/core/analogTuning): a key held without a break for the tuned
 * time turns at the hard-turn rate instead of the bank rate. Legs that cross
 * the moment the boost starts are split in two exact arcs, so the result does
 * not depend on the tick length (like src/core/analogSteering).
 *
 * Pure: no Phaser.
 */

import { CYCLE_DURATION_MS } from "../config";
import {
  flyAnalogLeg,
  type AnalogLeg,
  type AnalogSide,
  type AnalogSteer,
} from "./analogSteering";
import type { AnalogTuning, HeldBoost } from "./analogTuning";

/** A ship's pose. */
interface Pose {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/**
 * @param boost - The boost, or null.
 * @param heldMs - How long the key has been held already (ms).
 * @param durationMs - Length of the stretch (ms).
 * @returns How much of the stretch is flown before the boost applies (ms).
 */
function unboostedMs(
  boost: HeldBoost | null,
  heldMs: number,
  durationMs: number,
): number {
  if (!boost) return durationMs;
  return Math.min(durationMs, Math.max(0, boost.afterMs - heldMs));
}

/**
 * Fly a pose along a key-held leg that may earn the boost on the way.
 *
 * @param pose - Pose at the start of the leg.
 * @param leg - The leg at the base rate.
 * @param boost - The boost a long hold earns, or null.
 * @param heldMs - Hold time already behind the leg (ms).
 * @returns The pose at the end of the leg.
 */
export function flyBoostedLeg(
  pose: Pose,
  leg: AnalogLeg,
  boost: HeldBoost | null,
  heldMs: number,
): { x: number; y: number; angle: number } {
  const beforeMs = unboostedMs(boost, heldMs, leg.durationMs);
  const first = flyAnalogLeg(pose, { ...leg, durationMs: beforeMs });
  if (!boost || beforeMs >= leg.durationMs) return first;
  return flyAnalogLeg(first, {
    ...leg,
    rateDeg: boost.rateDeg,
    durationMs: leg.durationMs - beforeMs,
  });
}

/**
 * @param rateDeg - Base turn rate (°/cycle).
 * @param boost - The boost a long hold earns, or null.
 * @param heldMs - Hold time already behind the stretch (ms).
 * @param durationMs - Length of the stretch (ms).
 * @returns The heading change of the stretch (°).
 */
export function boostedSweepDeg(
  rateDeg: number,
  boost: HeldBoost | null,
  heldMs: number,
  durationMs: number,
): number {
  const beforeMs = unboostedMs(boost, heldMs, durationMs);
  const boostedMs = durationMs - beforeMs;
  return (
    (rateDeg * beforeMs + (boost ? boost.rateDeg * boostedMs : 0)) /
    CYCLE_DURATION_MS
  );
}

/**
 * @param analog - Steering state before the key changed.
 * @param side - Key held after the change.
 * @returns How long the key has been held without a break: kept while the same
 * side stays down (or the cycle boundary replans it), 0 after a release or a reversal.
 */
export function keptHeldMs(analog: AnalogSteer, side: AnalogSide): number {
  if (side === "none") return 0;
  return analog.held !== "none" && analog.held !== side ? 0 : analog.heldMs;
}

/**
 * @param analog - Steering state of a held key.
 * @param stepMs - Time the key stayed down this tick (ms).
 * @param tuning - The ship's tuning (a boosted hold counts as a hard turn).
 * @returns The state with the heading turned and the hold time grown; once the
 * boost applies the cycle is classified against the hard turn.
 */
export function turnedFurther(
  analog: AnalogSteer,
  stepMs: number,
  tuning: AnalogTuning,
): AnalogSteer {
  const turnedDeg =
    analog.turnedDeg +
    boostedSweepDeg(analog.rateDeg, analog.boost, analog.heldMs, stepMs);
  const heldMs = analog.heldMs + stepMs;
  const boosted = analog.boost !== null && heldMs >= analog.boost.afterMs;
  return {
    ...analog,
    turnedDeg,
    heldMs,
    ...(boosted
      ? { dialMaxDeg: tuning.turnDegrees, turnKind: "turn" as const }
      : {}),
  };
}

/**
 * How long a key must be held from now to turn `wantedDeg`, within one cycle.
 *
 * @param wantedDeg - The heading change wanted (°).
 * @param rateDeg - Base turn rate (°/cycle).
 * @param boost - The boost a long hold earns, or null.
 * @param heldMs - Hold time already behind the hold (ms).
 * @returns The hold (ms), at most one cycle.
 */
export function holdMsFor(
  wantedDeg: number,
  rateDeg: number,
  boost: HeldBoost | null,
  heldMs: number,
): number {
  const baseMsPerDeg = CYCLE_DURATION_MS / rateDeg;
  const beforeMs = unboostedMs(boost, heldMs, CYCLE_DURATION_MS);
  const beforeDeg = beforeMs / baseMsPerDeg;
  if (!boost || wantedDeg <= beforeDeg)
    return Math.min(CYCLE_DURATION_MS, wantedDeg * baseMsPerDeg);
  const boostedMsPerDeg = CYCLE_DURATION_MS / boost.rateDeg;
  return Math.min(
    CYCLE_DURATION_MS,
    beforeMs + (wantedDeg - beforeDeg) * boostedMsPerDeg,
  );
}
