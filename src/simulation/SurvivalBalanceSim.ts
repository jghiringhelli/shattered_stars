/**
 * Survival roguelite — headless balance simulator (pure, no Phaser, no I/O).
 *
 * Models the ADR-0003 *economy*: each level the fleet's derived power is compared
 * to the wave's threat to decide survival, then a {@link DraftPolicy} spends the
 * reward. Running many seeds per policy exposes the balance curve (how far runs
 * get, build diversity, spike unlock rates) so the threat/power coefficients can
 * be tuned. This is an economy model, not a combat replica: it is deterministic
 * and seedable, and its invariants (monotonic threat/power, determinism, bounded
 * runs) are unit-tested — not its absolute realism.
 *
 * See docs/adr/ADR-0003-survival-roguelite-leveling.md.
 */

import { createSeededRng } from "../utils/random";
import {
  type HullClass,
  type StatBonuses,
  type SurvivalRunState,
  BRANCHES,
} from "../data/survival/model";
import { SurvivalRunController } from "../systems/survival/SurvivalRunController";
import { computeThreat } from "../data/survival/threat";
import { escortFleetPower } from "../data/survival/escorts";
import { driveEffect } from "../systems/survival/FleetEffects";
import type { DraftPolicy } from "./SurvivalDraftPolicy";

// ─── Fleet power model (documented tuning constants) ─────────────────────────

/** Baseline single-ship stats before any drafted bonuses. */
export const BASE_DAMAGE = 3;
export const BASE_HULL = 6;
export const BASE_SHIELDS = 2;

/** Each evasion point adds this fraction of effective durability. */
export const EVASION_FACTOR = 0.08;

/** Durability the Drive top-speed notch is worth (≈ one evasion point). */
export const DRIVE_TOP_SPEED_FACTOR = 0.08;

/** Durability per unit of boost-recharge reduction from Drive. */
export const DRIVE_BOOST_FACTOR = 0.2;

/**
 * Drive ("speed" powers) as the battle applies it (FleetEffects.driveEffect:
 * a top-speed notch, then faster boost recharge with a floor), converted to
 * a durability fraction — mobility means dodging and disengaging.
 *
 * @param speed - The run's speed bonus.
 * @returns Durability fraction added by Drive.
 */
export function driveMobility(speed: number): number {
  const drive = driveEffect(speed);
  return (
    (drive.maxSpeedBonus ?? 0) * DRIVE_TOP_SPEED_FACTOR +
    (1 - (drive.boostCooldownMultiplier ?? 1)) * DRIVE_BOOST_FACTOR
  );
}

/** Threat units are converted to a power-equivalent by this factor. */
export const THREAT_TO_POWER = 0.32;

/** Logistic steepness around power parity (higher = sharper win/lose cliff). */
export const SURVIVAL_STEEPNESS = 2;

/** Hard ceiling on fleet size (matches the scene's MAX_FLEET). */
export const SIM_MAX_FLEET = 6;

/** Runs cannot exceed this level (bounds otherwise-snowballing builds). */
export const SIM_MAX_LEVEL = 60;

/** Effective number of hulls for threat accounting, escort-inclusive and capped. */
function shipCount(state: Readonly<SurvivalRunState>): number {
  return Math.min(1 + state.escorts, SIM_MAX_FLEET);
}

/**
 * Total fleet combat power: the flagship (a single, fully-upgraded ship) plus
 * the escort wing. Escorts are weak, basic bodies whose contribution scales with
 * support investment (fleet branch + carrier hull), never with the flagship's
 * own bonuses — so stacking escorts without support yields diminishing returns
 * rather than the old runaway where each escort was a flagship copy.
 */
function totalFleetPower(state: Readonly<SurvivalRunState>): number {
  return fleetPower(state.bonuses, 1) + escortFleetPower(state);
}

/**
 * Derived combat power of the fleet. Geometric mean of offense and durability so
 * lopsided glass-cannon / pillow-fist builds are penalised versus rounded ones.
 */
export function fleetPower(
  bonuses: Readonly<StatBonuses>,
  ships: number,
): number {
  const offense =
    (BASE_DAMAGE + bonuses.damage) *
    (1 + bonuses.critChance) *
    (1 + bonuses.fireRate) *
    ships;
  const durability =
    (BASE_HULL + bonuses.maxHull + BASE_SHIELDS + bonuses.maxShields) *
    (1 + bonuses.evasion * EVASION_FACTOR + driveMobility(bonuses.speed)) *
    ships;
  return Math.sqrt(Math.max(0, offense) * Math.max(0, durability));
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Probability the fleet clears a wave of the given threat. 0.5 at power parity. */
export function survivalProbability(power: number, threat: number): number {
  const threatPower = threat * THREAT_TO_POWER;
  if (threatPower <= 0) return 1;
  const ratio = power / threatPower;
  return logistic(SURVIVAL_STEEPNESS * (ratio - 1));
}

// ─── Single run ──────────────────────────────────────────────────────────────

export interface RunResult {
  policy: string;
  seed: number;
  levelsCleared: number;
  finalHull: HullClass;
  escorts: number;
  capstones: number;
  crosses: number;
  peakPower: number;
  /** Branch depths at death, ordered by BRANCHES. */
  branchSpread: number[];
}

function countTiers(state: Readonly<SurvivalRunState>): {
  capstones: number;
  crosses: number;
} {
  let capstones = 0;
  let crosses = 0;
  for (const id of state.taken) {
    if (id.startsWith("cap_")) capstones += 1;
    else if (id.startsWith("x_")) crosses += 1;
  }
  return { capstones, crosses };
}

/** Simulates one full survival run under a policy; returns its outcome record. */
export function simulateRun(
  seed: number,
  policy: DraftPolicy,
  hull?: HullClass,
): RunResult {
  const controller = new SurvivalRunController(seed, hull);
  const combatRng = createSeededRng((seed ^ 0x9e3779b9) >>> 0);
  let levelsCleared = 0;
  let peakPower = 0;

  while (controller.level < SIM_MAX_LEVEL) {
    controller.beginWave();
    const power = totalFleetPower(controller.state);
    peakPower = Math.max(peakPower, power);
    const threat = computeThreat(controller.state, shipCount(controller.state));

    if (combatRng.next() >= survivalProbability(power, threat)) break;
    levelsCleared = controller.level;

    if (controller.isMilestone) {
      const options = controller.hangar();
      if (options.length > 0) {
        controller.chooseHangar(policy.pickHangar(options, controller.state));
      }
    } else {
      const offered = controller.draft();
      if (offered.length > 0) {
        controller.choosePower(policy.pickPower(offered, controller.state));
      }
    }

    // Parallel escort-track decision every wave (independent of the power draft).
    const escortOffered = controller.draftEscort();
    if (escortOffered.length > 0) {
      controller.chooseEscort(
        policy.pickEscort(escortOffered, controller.state),
      );
    }
  }

  const state = controller.state;
  const { capstones, crosses } = countTiers(state);
  return {
    policy: policy.name,
    seed,
    levelsCleared,
    finalHull: state.hull,
    escorts: state.escorts,
    capstones,
    crosses,
    peakPower,
    branchSpread: BRANCHES.map((b) => state.branch[b]),
  };
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

export interface PolicySummary {
  policy: string;
  runs: number;
  p10: number;
  median: number;
  p90: number;
  meanCapstones: number;
  meanCrosses: number;
  hullDistribution: Record<string, number>;
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)));
  return sorted[idx]!;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Aggregates a batch of {@link RunResult} into distribution statistics. */
export function summarise(policy: string, results: RunResult[]): PolicySummary {
  const levels = results.map((r) => r.levelsCleared).sort((a, b) => a - b);
  const hullDistribution: Record<string, number> = {};
  for (const r of results) {
    hullDistribution[r.finalHull] = (hullDistribution[r.finalHull] ?? 0) + 1;
  }
  return {
    policy,
    runs: results.length,
    p10: percentile(levels, 0.1),
    median: percentile(levels, 0.5),
    p90: percentile(levels, 0.9),
    meanCapstones: mean(results.map((r) => r.capstones)),
    meanCrosses: mean(results.map((r) => r.crosses)),
    hullDistribution,
  };
}

/** Runs `runs` seeded simulations for a policy and summarises them. */
export function sweepPolicy(
  policy: DraftPolicy,
  runs: number,
  baseSeed: number,
  hull?: HullClass,
): { summary: PolicySummary; results: RunResult[] } {
  const results: RunResult[] = [];
  for (let i = 0; i < runs; i++) {
    results.push(simulateRun(baseSeed + i, policy, hull));
  }
  return { summary: summarise(policy.name, results), results };
}
