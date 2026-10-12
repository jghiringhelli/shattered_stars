/**
 * merge — folds a section's seed blocks back into one result per cell
 * (tallies summed, lengths concatenated).
 */

import {
  addTallies,
  EMPTY_TALLY,
  type WinTally,
} from "../../src/simulation/balance/balanceStats";
import type { BalanceJobResult } from "../../src/simulation/balance/balanceJobs";
import type { DuelSeries } from "../../src/simulation/balance/duelBalance";
import type { PairResult } from "../../src/simulation/balance/factionMatrix";
import type { ShipValue } from "../../src/simulation/balance/roleValue";
import type { ScenarioSeries } from "../../src/simulation/balance/scenarioBalance";

/**
 * @param results - Every result by key ("section|cell|block").
 * @param section - A section.
 * @returns Its blocks grouped by cell.
 */
export function cellsOf(
  results: ReadonlyMap<string, BalanceJobResult>,
  section: string,
): Map<string, BalanceJobResult[]> {
  const cells = new Map<string, BalanceJobResult[]>();
  for (const [key, value] of results) {
    const [s, cell] = key.split("|");
    if (s !== section || cell === undefined) continue;
    cells.set(cell, [...(cells.get(cell) ?? []), value]);
  }
  return cells;
}

/** @param blocks - Pairing blocks. @returns One pairing. */
export function mergePairs(blocks: readonly BalanceJobResult[]): PairResult {
  const pairs = blocks as PairResult[];
  return {
    a: pairs[0]!.a,
    b: pairs[0]!.b,
    tally: pairs.reduce((t, p) => addTallies(t, p.tally), EMPTY_TALLY),
    durationsMs: pairs.flatMap((p) => p.durationsMs),
  };
}

/** @param blocks - Duel blocks. @returns One series. */
export function mergeDuels(blocks: readonly BalanceJobResult[]): DuelSeries {
  const series = blocks as DuelSeries[];
  return {
    tally: series.reduce((t, s) => addTallies(t, s.tally), EMPTY_TALLY),
    durationsMs: series.flatMap((s) => s.durationsMs),
    timeouts: series.reduce((n, s) => n + s.timeouts, 0),
    rounds: series.reduce((n, s) => n + s.rounds, 0),
  };
}

/** @param blocks - Tally blocks. @returns Their sum. */
export function mergeTallies(blocks: readonly BalanceJobResult[]): WinTally {
  return (blocks as WinTally[]).reduce(addTallies, EMPTY_TALLY);
}

/** @param blocks - Scenario blocks. @returns One series. */
export function mergeScenarios(
  blocks: readonly BalanceJobResult[],
): ScenarioSeries {
  const series = blocks as ScenarioSeries[];
  const reasons: Record<string, number> = {};
  for (const s of series)
    for (const [reason, n] of Object.entries(s.reasons))
      reasons[reason] = (reasons[reason] ?? 0) + n;
  return {
    listTally: series.reduce((t, s) => addTallies(t, s.listTally), EMPTY_TALLY),
    seatTally: series.reduce((t, s) => addTallies(t, s.seatTally), EMPTY_TALLY),
    durationsMs: series.flatMap((s) => s.durationsMs),
    reasons,
  };
}

/** @param blocks - The single ship-value block. @returns It. */
export function shipValueOf(blocks: readonly BalanceJobResult[]): ShipValue {
  return blocks[0] as ShipValue;
}
