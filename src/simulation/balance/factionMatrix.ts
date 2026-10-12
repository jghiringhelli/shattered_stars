/**
 * factionMatrix — every faction against every other at equal budgets, in
 * classic squads (the Skirmish AI's auto-fill lists) and in reinforced
 * battles (opening auto-fill squad + the faction's strategy plan), each
 * pairing seen from both seats. A faction's overall share pools all its
 * games.
 *
 * Pure: no Phaser.
 */

import type { FactionId } from "../../config";
import type { StrategyId } from "../../arcade/reinforcements";
import type { SideSkill } from "../arenaLoop";
import { runReinforcedBattle } from "../ReinforcedBattleSim";
import {
  addTallies,
  EMPTY_TALLY,
  flipTally,
  type WinTally,
} from "./balanceStats";
import { AVERAGE_SKILL, runSquadMatchup } from "./squadMatchup";
import { BALANCE_FACTIONS, type SquadList } from "./squadLists";

/** One ordered pairing's result, seen from `a`. */
export interface PairResult {
  readonly a: FactionId;
  readonly b: FactionId;
  readonly tally: WinTally;
  readonly durationsMs: readonly number[];
}

/** Unordered pairs of distinct factions (a before b in roster order). */
export function factionPairs(): Array<[FactionId, FactionId]> {
  const pairs: Array<[FactionId, FactionId]> = [];
  BALANCE_FACTIONS.forEach((a, i) =>
    BALANCE_FACTIONS.slice(i + 1).forEach((b) => pairs.push([a, b])),
  );
  return pairs;
}

/**
 * Classic squads: list a vs list b over every seed, both seatings.
 * @param a - First list.
 * @param b - Second list.
 * @param seeds - Seeds.
 * @returns The pairing seen from a.
 */
export function classicPair(
  a: SquadList,
  b: SquadList,
  seeds: readonly number[],
): PairResult {
  const result = runSquadMatchup({ a, b, seeds });
  return {
    a: a.faction,
    b: b.faction,
    tally: result.tally,
    durationsMs: result.durationsMs,
  };
}

/** A reinforced pairing to play. */
export interface ReinforcedPairSpec {
  readonly a: SquadList;
  readonly b: SquadList;
  readonly seeds: readonly number[];
  readonly strategyA?: StrategyId;
  readonly strategyB?: StrategyId;
  readonly skill?: SideSkill;
}

/**
 * Reinforced battles: each seed with a on the player's side, then on the AI's.
 * @param spec - Opening lists, strategies, pilots, seeds.
 * @returns The pairing seen from a.
 */
export function reinforcedPair(spec: ReinforcedPairSpec): PairResult {
  const skill = spec.skill ?? AVERAGE_SKILL;
  const sideA = {
    opening: spec.a,
    strategy: spec.strategyA ?? "balanced",
    skill,
  };
  const sideB = {
    opening: spec.b,
    strategy: spec.strategyB ?? "balanced",
    skill,
  };
  let tally = EMPTY_TALLY;
  const durationsMs: number[] = [];
  for (const seed of spec.seeds) {
    const asPlayer = runReinforcedBattle({ player: sideA, enemy: sideB, seed });
    const asEnemy = runReinforcedBattle({ player: sideB, enemy: sideA, seed });
    tally = addTallies(tally, tallyOf(asPlayer.winner, "player"));
    tally = addTallies(tally, tallyOf(asEnemy.winner, "enemy"));
    durationsMs.push(asPlayer.durationMs, asEnemy.durationMs);
  }
  return { a: spec.a.faction, b: spec.b.faction, tally, durationsMs };
}

/**
 * @param winner - Who won.
 * @param mine - The side the tally belongs to.
 * @returns One game's tally.
 */
export function tallyOf(
  winner: "player" | "enemy" | "draw",
  mine: "player" | "enemy",
): WinTally {
  if (winner === "draw") return { wins: 0, losses: 0, draws: 1 };
  return winner === mine
    ? { wins: 1, losses: 0, draws: 0 }
    : { wins: 0, losses: 1, draws: 0 };
}

/**
 * @param pairs - Pairings (each seen from its a).
 * @returns Each faction's pooled tally over all its pairings.
 */
export function factionTotals(
  pairs: readonly PairResult[],
): Map<FactionId, WinTally> {
  const totals = new Map<FactionId, WinTally>(
    BALANCE_FACTIONS.map((f) => [f, EMPTY_TALLY]),
  );
  for (const pair of pairs) {
    totals.set(pair.a, addTallies(totals.get(pair.a)!, pair.tally));
    totals.set(pair.b, addTallies(totals.get(pair.b)!, flipTally(pair.tally)));
  }
  return totals;
}

/**
 * @param pairs - Pairings.
 * @param row - Row faction.
 * @param column - Column faction.
 * @returns The row faction's tally against the column faction, if played.
 */
export function cellOf(
  pairs: readonly PairResult[],
  row: FactionId,
  column: FactionId,
): WinTally | null {
  const direct = pairs.find((p) => p.a === row && p.b === column);
  if (direct) return direct.tally;
  const reverse = pairs.find((p) => p.a === column && p.b === row);
  return reverse ? flipTally(reverse.tally) : null;
}
