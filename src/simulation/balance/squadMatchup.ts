/**
 * squadMatchup — two squads fight seeded arena battles (the skill arena's
 * real engine: BotPilots, SquadCommand marks, CycleFlight, dice combat,
 * secondaries, auras), each seed played in both seatings so the layout and
 * seat cancel out. Results are seen from list A.
 *
 * Pure: no Phaser.
 */

import { runBattle, type BattleResult } from "../skill/SkillArena";
import type { SideSkill } from "../arenaLoop";
import { sideOf, type SquadList } from "./squadLists";
import { addTallies, EMPTY_TALLY, type WinTally } from "./balanceStats";

/** Normal difficulty: the average tier at its measured reaction. */
export const AVERAGE_SKILL: SideSkill = { tier: "average", reactionScale: 1 };

/** A series between two lists. */
export interface MatchupSpec {
  readonly a: SquadList;
  readonly b: SquadList;
  readonly seeds: readonly number[];
  /** Pilots of list A; default average. */
  readonly skillA?: SideSkill;
  /** Pilots of list B; default average. */
  readonly skillB?: SideSkill;
  readonly timeLimitMs?: number;
}

/** What a series produced, seen from list A. */
export interface MatchupResult {
  readonly tally: WinTally;
  /** Battle lengths (ms). */
  readonly durationsMs: readonly number[];
  /** Battles decided at the time limit. */
  readonly timeouts: number;
}

/**
 * Play every seed in both seatings.
 * @param spec - Lists, pilots, seeds.
 * @returns List A's tally and the battles' lengths.
 */
export function runSquadMatchup(spec: MatchupSpec): MatchupResult {
  const skillA = spec.skillA ?? AVERAGE_SKILL;
  const skillB = spec.skillB ?? AVERAGE_SKILL;
  const sideA = sideOf(spec.a, skillA);
  const sideB = sideOf(spec.b, skillB);
  const limit =
    spec.timeLimitMs !== undefined ? { timeLimitMs: spec.timeLimitMs } : {};
  let tally = EMPTY_TALLY;
  const durationsMs: number[] = [];
  let timeouts = 0;
  for (const seed of spec.seeds) {
    const seatings: Array<[BattleResult, "A" | "B"]> = [
      [runBattle({ A: sideA, B: sideB, seed, ...limit }), "A"],
      [runBattle({ A: sideB, B: sideA, seed, ...limit }), "B"],
    ];
    for (const [result, seatOfA] of seatings) {
      tally = addTallies(tally, outcomeFor(result, seatOfA));
      durationsMs.push(result.durationMs);
      if (result.endedBy === "timeout") timeouts += 1;
    }
  }
  return { tally, durationsMs, timeouts };
}

/**
 * @param result - A battle.
 * @param seat - The seat list A flew from.
 * @returns One game's tally for list A.
 */
export function outcomeFor(result: BattleResult, seat: "A" | "B"): WinTally {
  if (result.winner === "draw") return { wins: 0, losses: 0, draws: 1 };
  return result.winner === seat
    ? { wins: 1, losses: 0, draws: 0 }
    : { wins: 0, losses: 1, draws: 0 };
}
