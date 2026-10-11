/**
 * SkillGates — the two piloting gates as data: which ships and squads they
 * cover, the thresholds, and the battle specs they run.
 *
 * Gate 1: an expert beats a novice >= 85% in ANY pair of fighters (no
 *   capitals / huge), even when the novice's ship costs up to +30% more.
 * Gate 2: a coordinated squadron of AVERAGE pilots beats the same points of
 *   EXPERT aces each flying on their own >= 70%.
 *
 * Thresholds are fixed; if a gate fails, tune the levers, never these.
 * Pure: no Phaser.
 */

import { SHIP_DEFINITIONS } from "../../data/ShipDefinitions";
import type { ShipDefinition } from "../../core/types";
import type { ArenaRules } from "./ArenaRules";
import { spawnArenaShip } from "./ArenaShip";
import { runSeries, seedRange, type SeriesSummary } from "./ArenaStats";
import { BotPilot } from "../../arcade/ai/BotPilot";
import type { BattleSpec } from "./SkillArena";

/** Gate 1: minimum expert win rate against a novice, per pair. */
export const GATE1_MIN_EXPERT_WIN_RATE = 0.85;

/** Gate 1: the novice's ship may cost up to this much more than the expert's. */
export const GATE1_NOVICE_PRICE_PREMIUM = 0.3;

/**
 * Gate 1: a pair whose sampled win rate falls below the threshold is
 * re-measured with this many seeds and judged on that larger sample (with
 * 1,500+ pairs, 20 seeds alone would fail ~25 sound pairs on noise).
 */
export const GATE1_CONFIRM_SEEDS = 100;

/** Roles gate 1 covers (fighters: light, interceptor, heavy). */
export const GATE_FIGHTER_ROLES: readonly string[] = [
  "light_fighter",
  "interceptor",
  "heavy_fighter",
];

/** A ship left out of the gates and why. */
export interface ExcludedShip {
  readonly id: string;
  readonly reason: string;
}

/** The fighter roster gate 1 draws from. */
export interface FighterRoster {
  readonly fighters: readonly ShipDefinition[];
  readonly excluded: readonly ExcludedShip[];
}

/**
 * @returns Every non-huge fighter that can fly a battle, plus the ones left out.
 */
export function fighterRoster(): FighterRoster {
  const fighters: ShipDefinition[] = [];
  const excluded: ExcludedShip[] = [];
  for (const def of Object.values(SHIP_DEFINITIONS)) {
    if (!GATE_FIGHTER_ROLES.includes(def.role)) continue;
    if (def.baseStats.size === "huge") {
      excluded.push({ id: def.id, reason: "huge" });
      continue;
    }
    const probe = spawnArenaShip({
      id: "probe",
      side: "A",
      definitionId: def.id,
      pose: { x: 0, y: 0, angle: 0 },
      pilot: new BotPilot("novice"),
    });
    if (!probe.alive)
      excluded.push({
        id: def.id,
        reason: "spawns with 0 hull in continuous mode",
      });
    else fighters.push(def);
  }
  return { fighters, excluded };
}

/** One gate-1 matchup: the expert's ship and the novice's ship. */
export interface DuelPair {
  readonly expertShip: string;
  readonly noviceShip: string;
  /** Novice ship cost / expert ship cost. */
  readonly priceRatio: number;
}

/**
 * @param fighters - The roster.
 * @returns Every ordered pair where the novice's ship costs at most +30%.
 */
export function gate1Pairs(fighters: readonly ShipDefinition[]): DuelPair[] {
  const pairs: DuelPair[] = [];
  for (const expert of fighters) {
    for (const novice of fighters) {
      const priceRatio =
        novice.baseStats.pointCost / expert.baseStats.pointCost;
      if (priceRatio > 1 + GATE1_NOVICE_PRICE_PREMIUM + 1e-9) continue;
      pairs.push({ expertShip: expert.id, noviceShip: novice.id, priceRatio });
    }
  }
  return pairs;
}

/**
 * Deterministic sample: for every expert ship, its hardest pair (the
 * priciest novice ship allowed) and one more spread across the rest;
 * thinned evenly to `count`.
 * @param pairs - All gate-1 pairs.
 * @param count - Pairs wanted (all when >= pairs.length).
 * @returns The sample.
 */
export function sampleGate1Pairs(
  pairs: readonly DuelPair[],
  count: number,
): DuelPair[] {
  if (count >= pairs.length) return [...pairs];
  const byExpert = new Map<string, DuelPair[]>();
  for (const pair of pairs)
    byExpert.set(pair.expertShip, [
      ...(byExpert.get(pair.expertShip) ?? []),
      pair,
    ]);
  const picked: DuelPair[] = [];
  let index = 0;
  for (const group of byExpert.values()) {
    const sorted = [...group].sort((a, b) => b.priceRatio - a.priceRatio);
    picked.push(sorted[0]!);
    if (sorted.length > 1)
      picked.push(sorted[1 + (index % (sorted.length - 1))]!);
    index += 7;
  }
  const stride = picked.length / count;
  return picked.length <= count
    ? picked
    : Array.from({ length: count }, (_, i) => picked[Math.floor(i * stride)]!);
}

/** How much of the gate-1 matrix a sample covers. */
export interface PairCoverage {
  readonly sampledPairs: number;
  readonly totalPairs: number;
  readonly expertShips: number;
  readonly noviceShips: number;
  readonly rosterShips: number;
  /** Role matchups (expert role → novice role) covered, of 9. */
  readonly roleMatchups: number;
  readonly maxPriceRatio: number;
}

/**
 * @returns Coverage of the sample over all pairs and the roster.
 */
export function pairCoverage(
  sample: readonly DuelPair[],
  all: readonly DuelPair[],
  roster: readonly ShipDefinition[],
): PairCoverage {
  const role = (id: string): string => SHIP_DEFINITIONS[id]?.role ?? "?";
  return {
    sampledPairs: sample.length,
    totalPairs: all.length,
    expertShips: new Set(sample.map((p) => p.expertShip)).size,
    noviceShips: new Set(sample.map((p) => p.noviceShip)).size,
    rosterShips: roster.length,
    roleMatchups: new Set(
      sample.map((p) => `${role(p.expertShip)}>${role(p.noviceShip)}`),
    ).size,
    maxPriceRatio: Math.max(...sample.map((p) => p.priceRatio)),
  };
}

/**
 * @returns Gate-1 battle: expert on side A, novice on side B.
 */
export function duelSpec(
  pair: DuelPair,
  seed: number,
  rules?: ArenaRules,
): BattleSpec {
  return {
    A: {
      ships: [{ definitionId: pair.expertShip, tier: "expert" }],
      squad: null,
    },
    B: {
      ships: [{ definitionId: pair.noviceShip, tier: "novice" }],
      squad: null,
    },
    seed,
    ...(rules ? { rules } : {}),
  };
}

/** One gate-1 pair, measured. */
export interface PairMeasurement {
  readonly pair: DuelPair;
  /** The sample the pair is judged on (the confirmation when one ran). */
  readonly summary: SeriesSummary;
  /** Whether the first sample dipped below the threshold and was re-measured. */
  readonly confirmed: boolean;
}

/**
 * Measure a gate-1 pair: `seeds` battles, and when that dips below the
 * threshold, {@link GATE1_CONFIRM_SEEDS} battles to judge it on.
 * @param pair - The matchup.
 * @param seeds - First-pass sample size.
 * @param rules - Rules in force (engine by default).
 * @returns The judged summary.
 */
export function measureGate1Pair(
  pair: DuelPair,
  seeds: number,
  rules?: ArenaRules,
): PairMeasurement {
  const first = runSeries(
    (seed) => duelSpec(pair, seed, rules),
    seedRange(seeds),
  ).summary;
  if (
    first.winRate >= GATE1_MIN_EXPERT_WIN_RATE ||
    seeds >= GATE1_CONFIRM_SEEDS
  ) {
    return { pair, summary: first, confirmed: false };
  }
  const confirm = runSeries(
    (seed) => duelSpec(pair, seed, rules),
    seedRange(GATE1_CONFIRM_SEEDS),
  ).summary;
  return { pair, summary: confirm, confirmed: true };
}
