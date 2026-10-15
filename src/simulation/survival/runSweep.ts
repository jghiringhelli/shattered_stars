/**
 * runSweep — aggregates many simulated Survival runs into the balance
 * targets of ADR-0004: node clear rate per sector (and per node kind), run
 * win rate, and node length (p10 / median / p90).
 *
 * Pure: no Phaser, no I/O.
 */

import type { RunSimResult, NodeRecord } from "./SurvivalRunSim";
import { simulateSurvivalRun } from "./SurvivalRunSim";
import type { NodeSimOptions } from "./SurvivalNodeSim";
import { BALANCE_FACTIONS } from "../balance/squadLists";

/** Clear rate of one group of battle nodes. */
export interface ClearStats {
  readonly fought: number;
  readonly cleared: number;
  /** cleared / fought (NaN when none was fought). */
  readonly rate: number;
  readonly timeouts: number;
  readonly p10Ms: number;
  readonly medianMs: number;
  readonly p90Ms: number;
}

/** A sweep's summary. */
export interface SweepSummary {
  readonly runs: number;
  readonly winRate: number;
  /** Runs reaching each sector (index 0 = sector 1). */
  readonly reached: readonly number[];
  readonly bySector: readonly ClearStats[];
  readonly byKind: Readonly<Record<NodeRecord["kind"], ClearStats>>;
  readonly all: ClearStats;
}

/**
 * Play `runs` seeded runs.
 * @param runs - How many runs.
 * @param baseSeed - First seed.
 * @param ascension - Ascension level.
 * @param node - Battle options (belt behaviour of the simulated player).
 * @param mixedFactions - Fly every faction's starter in turn (seed % 5)
 *   instead of the Terran Hegemony's alone.
 * @returns Every run.
 */
export function sweepRuns(
  runs: number,
  baseSeed: number,
  ascension = 0,
  node: NodeSimOptions = {},
  mixedFactions = false,
): RunSimResult[] {
  return Array.from({ length: runs }, (_, i) => {
    const seed = baseSeed + i;
    return simulateSurvivalRun({
      seed,
      ascension,
      node,
      ...(mixedFactions
        ? { faction: BALANCE_FACTIONS[seed % BALANCE_FACTIONS.length]! }
        : {}),
    });
  });
}

/**
 * @param results - Simulated runs.
 * @param sectors - Sectors in a run.
 * @returns The sweep summary.
 */
export function summarizeSweep(
  results: readonly RunSimResult[],
  sectors = 3,
): SweepSummary {
  const battles = results.flatMap((r) => r.battles);
  const kinds = ["combat", "elite", "boss"] as const;
  return {
    runs: results.length,
    winRate: results.filter((r) => r.won).length / Math.max(1, results.length),
    reached: Array.from(
      { length: sectors },
      (_, i) => results.filter((r) => r.sectorReached >= i + 1).length,
    ),
    bySector: Array.from({ length: sectors }, (_, i) =>
      clearStats(battles.filter((b) => b.sector === i + 1)),
    ),
    byKind: Object.fromEntries(
      kinds.map((k) => [k, clearStats(battles.filter((b) => b.kind === k))]),
    ) as Record<NodeRecord["kind"], ClearStats>,
    all: clearStats(battles),
  };
}

/**
 * @param battles - Battle nodes.
 * @returns How many were cleared and how long they took.
 */
export function clearStats(battles: readonly NodeRecord[]): ClearStats {
  const cleared = battles.filter((b) => b.battle.won).length;
  const durations = battles
    .map((b) => b.battle.durationMs)
    .sort((a, b) => a - b);
  return {
    fought: battles.length,
    cleared,
    rate: battles.length > 0 ? cleared / battles.length : Number.NaN,
    timeouts: battles.filter((b) => b.battle.timedOut).length,
    p10Ms: percentile(durations, 0.1),
    medianMs: percentile(durations, 0.5),
    p90Ms: percentile(durations, 0.9),
  };
}

/**
 * @param sorted - Ascending values.
 * @param q - Quantile in [0, 1].
 * @returns The nearest-rank quantile (NaN when empty).
 */
export function percentile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(q * sorted.length) - 1),
  );
  return sorted[index]!;
}
