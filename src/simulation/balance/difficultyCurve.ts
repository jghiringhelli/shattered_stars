/**
 * difficultyCurve — how often an average "player" bot beats the AI at each
 * difficulty label, mode by mode, with the AI flying exactly what the label
 * maps to (BotDifficulty.difficultyToTier) and the player's wingmen at the
 * average tier (WINGMAN_SKILL / ESCORT_SKILL, as the scenes fly them):
 * - Dogfight: the default pairing, both seatings;
 * - Ace Duel: every preset, the player on each side in turn;
 * - Skirmish classic / reinforced: each faction's auto-fill list against its
 *   simple-flow opponent (pickOpponentFaction);
 * - Scenario: the same pairings, each also with the lists swapped (one
 *   scenario per pairing, so a pairing's faction edge would otherwise read
 *   as difficulty).
 *
 * Pure: no Phaser.
 */

import type { FactionId } from "../../config";
import {
  difficultyToTier,
  squadSkillPlan,
  type BotSkill,
} from "../../arcade/ai/BotDifficulty";
import type { CrewSkill } from "../crewSkill";
import { SCENARIO_IDS, type ScenarioId } from "../../arcade/scenarios";
import { pickOpponentFaction } from "../../core/squadTypes";
import { ACE_MATCHUPS } from "../../data/AceMatchups";
import { DOGFIGHT_DEFAULT_PAIRING } from "../../data/DogfightDefaults";
import { runReinforcedBattle } from "../ReinforcedBattleSim";
import { addTallies, EMPTY_TALLY, type WinTally } from "./balanceStats";
import { aceSides, runDuelSeries } from "./duelBalance";
import { tallyOf } from "./factionMatrix";
import { AVERAGE_SKILL, runSquadMatchup } from "./squadMatchup";
import { BALANCE_FACTIONS, skirmishAutoFillList } from "./squadLists";

/** The difficulty labels every mode offers, easiest first. */
export const DIFFICULTY_LABELS = ["easy", "normal", "hard", "brutal"] as const;
export type DifficultyLabel = (typeof DIFFICULTY_LABELS)[number];

/** The modes the curve is measured in. */
export const CURVE_MODES = [
  "dogfight",
  "ace",
  "classic",
  "reinforced",
  "scenario",
] as const;
export type CurveMode = (typeof CURVE_MODES)[number];

/** The player's pilot: the average tier (Normal). */
const PLAYER_SKILL: BotSkill = AVERAGE_SKILL;

/**
 * The player bot's games against one difficulty in one mode.
 * @param mode - The mode.
 * @param label - The difficulty.
 * @param seeds - Seeds (each mode multiplies them by its seatings / lists).
 * @returns The player's tally.
 */
export function playerVersusDifficulty(
  mode: CurveMode,
  label: DifficultyLabel,
  seeds: readonly number[],
): WinTally {
  switch (mode) {
    case "classic":
      return playerVersusCrew(mode, squadSkillPlan(label, "classic"), seeds);
    case "reinforced":
      return playerVersusCrew(mode, squadSkillPlan(label, "reinforced"), seeds);
    case "scenario":
      return playerVersusCrew(mode, squadSkillPlan(label, "scenario"), seeds);
    default:
      return playerVersusSkill(mode, difficultyToTier(label, mode), seeds);
  }
}

/**
 * The player bot's squad-mode games against an AI crew (a skill or a
 * difficulty's slot plan).
 * @param mode - A squad mode.
 * @param ai - The AI side's crew.
 * @param seeds - Seeds (multiplied by the mode's lists).
 * @returns The player's tally.
 */
export function playerVersusCrew(
  mode: "classic" | "reinforced" | "scenario",
  ai: CrewSkill,
  seeds: readonly number[],
): WinTally {
  switch (mode) {
    case "classic":
      return eachFaction((f) => classic(f, ai, seeds));
    case "reinforced":
      return eachFaction((f) => reinforced(f, ai, seeds));
    case "scenario":
      return eachFaction((f, i) => mirroredScenario(f, ai, seeds, i));
  }
}

/**
 * The player bot's games against AI pilots of a given skill in one mode.
 * @param mode - The mode.
 * @param ai - The AI's tier and reaction scale.
 * @param seeds - Seeds (each mode multiplies them by its seatings / lists).
 * @returns The player's tally.
 */
export function playerVersusSkill(
  mode: CurveMode,
  ai: BotSkill,
  seeds: readonly number[],
): WinTally {
  switch (mode) {
    case "dogfight":
      return dogfight(ai, seeds);
    case "ace":
      return ace(ai, seeds);
    case "classic":
      return eachFaction((f) => classic(f, ai, seeds));
    case "reinforced":
      return eachFaction((f) => reinforced(f, ai, seeds));
    case "scenario":
      return eachFaction((f, i) => mirroredScenario(f, ai, seeds, i));
  }
}

function dogfight(ai: BotSkill, seeds: readonly number[]): WinTally {
  const { player, enemy } = DOGFIGHT_DEFAULT_PAIRING;
  return runDuelSeries({
    side1: { ships: [player.shipId], kit: {} },
    side2: { ships: [enemy.shipId], kit: {} },
    seeds,
    skill1: PLAYER_SKILL,
    skill2: ai,
  }).tally;
}

function ace(ai: BotSkill, seeds: readonly number[]): WinTally {
  let tally = EMPTY_TALLY;
  for (const matchup of ACE_MATCHUPS) {
    const { side1, side2 } = aceSides(matchup);
    const asSide1 = runDuelSeries({
      side1,
      side2,
      seeds,
      skill1: PLAYER_SKILL,
      skill2: ai,
    }).tally;
    const asSide2 = runDuelSeries({
      side1: side2,
      side2: side1,
      seeds,
      skill1: PLAYER_SKILL,
      skill2: ai,
    }).tally;
    tally = addTallies(tally, addTallies(asSide1, asSide2));
  }
  return tally;
}

function eachFaction(
  play: (faction: FactionId, index: number) => WinTally,
): WinTally {
  return BALANCE_FACTIONS.reduce(
    (sum, faction, i) => addTallies(sum, play(faction, i)),
    EMPTY_TALLY,
  );
}

function classic(
  faction: FactionId,
  ai: CrewSkill,
  seeds: readonly number[],
): WinTally {
  return runSquadMatchup({
    a: skirmishAutoFillList(faction),
    b: skirmishAutoFillList(pickOpponentFaction(faction)),
    seeds,
    skillA: PLAYER_SKILL,
    skillB: ai,
  }).tally;
}

function reinforced(
  faction: FactionId,
  ai: CrewSkill,
  seeds: readonly number[],
  scenario?: ScenarioId,
  opponent: FactionId = pickOpponentFaction(faction),
): WinTally {
  const player = {
    opening: skirmishAutoFillList(faction),
    strategy: "balanced" as const,
    skill: PLAYER_SKILL,
  };
  const enemy = {
    opening: skirmishAutoFillList(opponent),
    strategy: "balanced" as const,
    skill: ai,
  };
  return seeds.reduce((sum, seed) => {
    const result = runReinforcedBattle({
      player,
      enemy,
      seed,
      ...(scenario ? { scenario } : {}),
    });
    return addTallies(sum, tallyOf(result.winner, "player"));
  }, EMPTY_TALLY);
}

/**
 * A faction's scenario games: its pairing played both ways round (the
 * player on each list) on the faction's scenario.
 * @param faction - The faction.
 * @param ai - The AI side's crew.
 * @param seeds - Seeds.
 * @param index - The faction's roster index (picks the scenario).
 * @returns The player's tally.
 */
function mirroredScenario(
  faction: FactionId,
  ai: CrewSkill,
  seeds: readonly number[],
  index: number,
): WinTally {
  const opponent = pickOpponentFaction(faction);
  const scenario = scenarioFor(index);
  return addTallies(
    reinforced(faction, ai, seeds, scenario, opponent),
    reinforced(opponent, ai, seeds, scenario, faction),
  );
}

/** Factions rotate through the scenarios so each is played. */
function scenarioFor(index: number): ScenarioId {
  return SCENARIO_IDS[index % SCENARIO_IDS.length]!;
}
