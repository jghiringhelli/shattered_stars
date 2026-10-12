/**
 * duelBalance — Ace Duel presets and the Dogfight default pairing on the
 * real duel engine (DuelTempoSim: the scenes' BotPilots, quick builds and
 * secondaries, the aces' sheet and ad-hoc abilities), each seed flown in
 * both seats so the spawn side cancels out. Results are seen from the
 * preset's side 1.
 *
 * Pure: no Phaser.
 */

import type { AceMatchup } from "../../data/AceMatchups";
import type { BotSkill } from "../../arcade/ai/BotDifficulty";
import {
  simulateDuelRound,
  type DuelTempoConfig,
  type DuelTempoResult,
} from "../DuelTempoSim";
import type { DuelSideKit } from "../duelSimShips";
import { addTallies, EMPTY_TALLY, type WinTally } from "./balanceStats";

/** One side of a duel as the harness flies it. */
export interface DuelSide {
  readonly ships: readonly string[];
  readonly kit: DuelSideKit;
}

/** A duel series' result, seen from side 1. */
export interface DuelSeries {
  readonly tally: WinTally;
  /** Lengths of decided rounds (ms). */
  readonly durationsMs: readonly number[];
  readonly timeouts: number;
  readonly rounds: number;
}

/** What a duel series needs. */
export interface DuelSeriesSpec {
  readonly side1: DuelSide;
  readonly side2: DuelSide;
  readonly seeds: readonly number[];
  readonly skill1: BotSkill;
  readonly skill2: BotSkill;
}

/**
 * @param matchup - An Ace Duel preset.
 * @param withAbilities - Fly the aces' abilities (as the scene does).
 * @returns Its two sides (default builds, as the scene preselects).
 */
export function aceSides(
  matchup: AceMatchup,
  withAbilities = true,
): { side1: DuelSide; side2: DuelSide } {
  const sideOf = (side: AceMatchup["side1"]): DuelSide => ({
    ships: side.ships,
    kit: { abilities: withAbilities ? side.abilities : [] },
  });
  return { side1: sideOf(matchup.side1), side2: sideOf(matchup.side2) };
}

/**
 * Fly every seed with side 1 in seat 1, then in seat 2.
 * @param spec - Sides, pilots and seeds.
 * @returns Side 1's tally, decided-round lengths and timeouts.
 */
export function runDuelSeries(spec: DuelSeriesSpec): DuelSeries {
  let tally = EMPTY_TALLY;
  const durationsMs: number[] = [];
  let timeouts = 0;
  for (const seed of spec.seeds) {
    for (const seat of [1, 2] as const) {
      const round = simulateDuelRound(configFor(spec, seed, seat));
      tally = addTallies(tally, outcomeOf(round, seat));
      if (round.durationMs === null) timeouts += 1;
      else durationsMs.push(round.durationMs);
    }
  }
  return { tally, durationsMs, timeouts, rounds: spec.seeds.length * 2 };
}

function configFor(
  spec: DuelSeriesSpec,
  seed: number,
  seat: 1 | 2,
): DuelTempoConfig {
  const [first, second] =
    seat === 1
      ? [
          { side: spec.side1, skill: spec.skill1 },
          { side: spec.side2, skill: spec.skill2 },
        ]
      : [
          { side: spec.side2, skill: spec.skill2 },
          { side: spec.side1, skill: spec.skill1 },
        ];
  return {
    side1: first.side.ships,
    side2: second.side.ships,
    side1Kit: first.side.kit,
    side2Kit: second.side.kit,
    seed,
    tier: first.skill.tier,
    reactionScale: first.skill.reactionScale,
    side2Tier: second.skill.tier,
    side2ReactionScale: second.skill.reactionScale,
  };
}

/** A timed-out round is a draw (the scenes call it a draw too). */
function outcomeOf(round: DuelTempoResult, seat: 1 | 2): WinTally {
  if (round.winner === null) return { wins: 0, losses: 0, draws: 1 };
  return round.winner === seat
    ? { wins: 1, losses: 0, draws: 0 }
    : { wins: 0, losses: 1, draws: 0 };
}
