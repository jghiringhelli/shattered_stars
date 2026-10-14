/**
 * scenarioBalance — Scenario mode on the real engine: each seed is played
 * with list X on the player's side, then with the lists swapped, so the
 * seat's bias (does the "enemy" side score more whatever it flies?) and
 * the lists' strength separate. Classic scenarios run in ScenarioMatchSim,
 * reinforced ones (the default) in ReinforcedBattleSim.
 *
 * Pure: no Phaser.
 */

import type { ScenarioId } from "../../arcade/scenarios";
import type { BotSkill } from "../../arcade/ai/BotDifficulty";
import { runReinforcedBattle } from "../ReinforcedBattleSim";
import { runScenarioMatch } from "../ScenarioMatchSim";
import { addTallies, EMPTY_TALLY, type WinTally } from "./balanceStats";
import { tallyOf } from "./factionMatrix";
import { AVERAGE_SKILL } from "./squadMatchup";
import type { SquadList } from "./squadLists";

/** A scenario series to play. */
export interface ScenarioSeriesSpec {
  readonly scenario: ScenarioId;
  readonly listX: SquadList;
  readonly listY: SquadList;
  readonly seeds: readonly number[];
  readonly reinforced: boolean;
  /** Both sides' pilots; default average. */
  readonly skill?: BotSkill;
}

/** What a scenario series produced. */
export interface ScenarioSeries {
  /** List X's games. */
  readonly listTally: WinTally;
  /** The player seat's games (whatever list flew it). */
  readonly seatTally: WinTally;
  readonly durationsMs: readonly number[];
  /** How matches ended (threshold / time / annihilation). */
  readonly reasons: Readonly<Record<string, number>>;
}

interface Game {
  readonly winner: "player" | "enemy" | "draw";
  readonly reason: string;
  readonly durationMs: number;
}

/**
 * @param spec - Scenario, lists, seeds, variant.
 * @returns List and seat tallies, lengths and end reasons.
 */
export function runScenarioSeries(spec: ScenarioSeriesSpec): ScenarioSeries {
  let listTally = EMPTY_TALLY;
  let seatTally = EMPTY_TALLY;
  const durationsMs: number[] = [];
  const reasons: Record<string, number> = {};
  for (const seed of spec.seeds) {
    for (const xIsPlayer of [true, false]) {
      const [player, enemy] = xIsPlayer
        ? [spec.listX, spec.listY]
        : [spec.listY, spec.listX];
      const game = playOne(spec, player, enemy, seed);
      seatTally = addTallies(seatTally, tallyOf(game.winner, "player"));
      listTally = addTallies(
        listTally,
        tallyOf(game.winner, xIsPlayer ? "player" : "enemy"),
      );
      durationsMs.push(game.durationMs);
      reasons[game.reason] = (reasons[game.reason] ?? 0) + 1;
    }
  }
  return { listTally, seatTally, durationsMs, reasons };
}

function playOne(
  spec: ScenarioSeriesSpec,
  player: SquadList,
  enemy: SquadList,
  seed: number,
): Game {
  const skill = spec.skill ?? AVERAGE_SKILL;
  if (spec.reinforced) {
    const result = runReinforcedBattle({
      player: { opening: player, strategy: "balanced", skill },
      enemy: { opening: enemy, strategy: "balanced", skill },
      seed,
      scenario: spec.scenario,
    });
    return {
      winner: result.winner,
      reason: result.endedBy,
      durationMs: result.durationMs,
    };
  }
  const match = runScenarioMatch(spec.scenario, seed, {
    player: skill.tier,
    enemy: skill.tier,
    playerReaction: skill.reactionScale,
    enemyReaction: skill.reactionScale,
    playerList: player.ships.map((s) => s.definitionId),
    enemyList: enemy.ships.map((s) => s.definitionId),
    playerBuilds: player.ships.map((s) => s.loadoutId),
    enemyBuilds: enemy.ships.map((s) => s.loadoutId),
  });
  return {
    winner: match.result.winner,
    reason: match.result.reason,
    durationMs: match.result.elapsedMs,
  };
}
