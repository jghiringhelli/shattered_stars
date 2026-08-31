/**
 * Support-aura uptime telemetry.
 *
 * Headless measurement of how often a lone escorted ally stays inside a support
 * ship's aura. The support ship pursues the ally with a bounded turn rate and
 * speed; the ally wanders with random heading jitter. Coverage is resolved with
 * the real {@link resolveSupportAuras} logic, so the reported uptime reflects
 * the same radius the arcade scene uses.
 *
 * This answers the tuning question directly: sweep the radius to find the value
 * that yields ~65-70% uptime for a lone anchored ally under default wander.
 */

import {
  alliesCoveredWithinRadius,
  type AuraShip,
} from "../systems/SupportAura";

/** Fixed simulation step (60 Hz), matching the arcade scene. */
const STEP_MS = 1000 / 60;

/** Mid-range coverage radius used when a measurement omits one. */
const DEFAULT_MEASURE_RADIUS = 300;

/** Tunable parameters for an uptime measurement. */
export interface AuraUptimeParams {
  /** Aura coverage radius in pixels. */
  readonly radius?: number;
  /** Ally cruise speed in px/s. */
  readonly allySpeed?: number;
  /** Support-ship cruise speed in px/s. */
  readonly supportSpeed?: number;
  /** Support-ship maximum turn rate in deg/s. */
  readonly supportTurnRateDegPerSec?: number;
  /** Ally heading jitter applied each second, in degrees. */
  readonly allyJitterDeg?: number;
  /** Simulated frames per seed. */
  readonly frames?: number;
  /** Number of random seeds averaged. */
  readonly seeds?: number;
}

interface Vec {
  x: number;
  y: number;
  heading: number;
}

/**
 * Deterministic RNG (mulberry32) for reproducible wander.
 * @param seed - Integer seed.
 * @returns A function yielding floats in [0, 1).
 */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Advance the ally one step with random heading jitter.
 * @param ally - Ally kinematic state (mutated).
 * @param speed - Cruise speed in px/s.
 * @param jitterDeg - Heading jitter per second in degrees.
 * @param rng - Random source.
 */
function stepAlly(
  ally: Vec,
  speed: number,
  jitterDeg: number,
  rng: () => number,
): void {
  const jitter = ((rng() - 0.5) * 2 * jitterDeg * STEP_MS) / 1000;
  ally.heading += (jitter * Math.PI) / 180;
  ally.x += Math.cos(ally.heading) * ((speed * STEP_MS) / 1000);
  ally.y += Math.sin(ally.heading) * ((speed * STEP_MS) / 1000);
}

/**
 * Advance the support ship one step, pursuing the ally within a turn budget.
 * @param support - Support kinematic state (mutated).
 * @param ally - Ally to pursue.
 * @param speed - Cruise speed in px/s.
 * @param turnRateDegPerSec - Maximum turn rate in deg/s.
 */
function stepSupport(
  support: Vec,
  ally: Vec,
  speed: number,
  turnRateDegPerSec: number,
): void {
  const desired = Math.atan2(ally.y - support.y, ally.x - support.x);
  let delta = desired - support.heading;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const maxTurn = (turnRateDegPerSec * Math.PI * STEP_MS) / (180 * 1000);
  support.heading += Math.max(-maxTurn, Math.min(maxTurn, delta));
  support.x += Math.cos(support.heading) * ((speed * STEP_MS) / 1000);
  support.y += Math.sin(support.heading) * ((speed * STEP_MS) / 1000);
}

/**
 * Build the two-ship snapshot consumed by {@link resolveSupportAuras}.
 * @param support - Support kinematic state.
 * @param ally - Ally kinematic state.
 * @returns A two-element ship array (support + ally).
 */
function snapshot(support: Vec, ally: Vec): AuraShip[] {
  return [
    {
      id: "support",
      x: support.x,
      y: support.y,
      faction: "terran_hegemony",
      role: "support",
      size: "medium",
      isUnique: false,
      equippedUpgrades: [],
      hull: 5,
      shields: 4,
      maxShields: 4,
    },
    {
      id: "ally",
      x: ally.x,
      y: ally.y,
      faction: "terran_hegemony",
      role: "heavy_fighter",
      size: "small",
      isUnique: false,
      equippedUpgrades: [],
      hull: 4,
      shields: 0,
      maxShields: 4,
    },
  ];
}

/**
 * Measure aura uptime for a lone escorted ally.
 *
 * @param params - Tunable measurement parameters.
 * @returns Fraction of frames (0-1) the ally sits inside the aura, averaged over seeds.
 */
export function measureAuraUptime(params: AuraUptimeParams = {}): number {
  const radius = params.radius ?? DEFAULT_MEASURE_RADIUS;
  const allySpeed = params.allySpeed ?? 220;
  const supportSpeed = params.supportSpeed ?? 210;
  const turnRate = params.supportTurnRateDegPerSec ?? 140;
  const jitterDeg = params.allyJitterDeg ?? 90;
  const frames = params.frames ?? 1800;
  const seeds = params.seeds ?? 12;

  let coveredTotal = 0;
  for (let s = 0; s < seeds; s++) {
    const rng = makeRng(s * 2654435761 + 1);
    const ally: Vec = { x: 0, y: 0, heading: rng() * Math.PI * 2 };
    const support: Vec = { x: 0, y: 0, heading: 0 };
    for (let f = 0; f < frames; f++) {
      stepAlly(ally, allySpeed, jitterDeg, rng);
      stepSupport(support, ally, supportSpeed, turnRate);
      const covered = alliesCoveredWithinRadius(
        snapshot(support, ally),
        radius,
      );
      if (covered.has("ally")) coveredTotal++;
    }
  }
  return coveredTotal / (frames * seeds);
}

/** One row of an uptime sweep. */
export interface AuraUptimeRow {
  readonly radius: number;
  readonly uptime: number;
}

/**
 * Sweep aura radius and report uptime for each.
 * @param radii - Radii to evaluate, in pixels.
 * @param params - Shared measurement parameters (radius is overridden per row).
 * @returns One uptime row per radius.
 */
export function sweepAuraUptime(
  radii: ReadonlyArray<number>,
  params: AuraUptimeParams = {},
): AuraUptimeRow[] {
  return radii.map((radius) => ({
    radius,
    uptime: measureAuraUptime({ ...params, radius }),
  }));
}
