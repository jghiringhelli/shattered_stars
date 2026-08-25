/**
 * FactionBalance — shared faction-matchup matrix utilities.
 *
 * Single source of truth for how a faction balance matrix is produced and read,
 * used by both the headless CLI (scripts/headless_sim.ts) and the CI balance
 * guardrail (tests/balance/SkirmishFactionBalance.test.ts). Keeps the win-rate
 * outlier threshold and aggregation logic in one place.
 */

import type { FactionId } from "../config";
import type { AggregatedStats } from "./BattleSimulator";
import { BattleSimulator } from "./BattleSimulator";

/** Win rate above which a matchup is flagged for point-cost review. */
export const WIN_RATE_OUTLIER = 0.6;

/** One directed matchup: team1 = faction a, team2 = faction b. */
export interface FactionMatchup {
  readonly a: FactionId;
  readonly b: FactionId;
  readonly stats: AggregatedStats;
}

/** Stable display/lookup key for a matchup. */
export function matchupKey(a: FactionId, b: FactionId): string {
  return `${a} vs ${b}`;
}

/**
 * Run every unordered faction pair at the given point budget, using each
 * faction's preset squad, and return the results as directed matchups (a<b order).
 */
export function runFactionMatrix(
  sim: BattleSimulator,
  factions: readonly FactionId[],
  budget: number,
  battlesPerMatchup: number,
): FactionMatchup[] {
  const matchups: FactionMatchup[] = [];
  for (let i = 0; i < factions.length; i++) {
    for (let j = i + 1; j < factions.length; j++) {
      const a = factions[i]!;
      const b = factions[j]!;
      const stats = sim.runBatchSimulation(
        sim.getPresetSquadForFaction(a, budget),
        sim.getPresetSquadForFaction(b, budget),
        battlesPerMatchup,
      );
      matchups.push({ a, b, stats });
    }
  }
  return matchups;
}

/** Build a keyed lookup map from matchups (for tabular display). */
export function matchupsToMap(
  matchups: readonly FactionMatchup[],
): Map<string, AggregatedStats> {
  return new Map(matchups.map((m) => [matchupKey(m.a, m.b), m.stats]));
}

/**
 * Aggregate each faction's win rate across all matchups it participated in.
 * Team 1 wins count for `a`, team 2 wins for `b`; draws count against both.
 */
export function aggregateFactionWinRates(
  matchups: readonly FactionMatchup[],
): Map<FactionId, number> {
  const wins = new Map<FactionId, number>();
  const played = new Map<FactionId, number>();
  const bump = (
    map: Map<FactionId, number>,
    faction: FactionId,
    amount: number,
  ): void => {
    map.set(faction, (map.get(faction) ?? 0) + amount);
  };

  for (const { a, b, stats } of matchups) {
    bump(wins, a, stats.team1Wins);
    bump(wins, b, stats.team2Wins);
    bump(played, a, stats.totalBattles);
    bump(played, b, stats.totalBattles);
  }

  const rates = new Map<FactionId, number>();
  for (const [faction, total] of played) {
    rates.set(faction, total === 0 ? 0 : (wins.get(faction) ?? 0) / total);
  }
  return rates;
}
