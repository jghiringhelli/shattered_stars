/**
 * balanceJobs — the balance report's units of work, as plain JSON so the
 * report can farm them out to worker processes: a faction pairing (classic,
 * reinforced, presets), a hull's value sweep, an Ace Duel preset at a tier,
 * the Dogfight default pairing, a difficulty cell, a scenario series.
 *
 * Pure: no Phaser (runs headless battles).
 */

import type { FactionId } from "../../config";
import type { BotTier } from "../../arcade/ai/BotTypes";
import type { ScenarioId } from "../../arcade/scenarios";
import { ACE_MATCHUPS } from "../../data/AceMatchups";
import { DOGFIGHT_DEFAULT_PAIRING } from "../../data/DogfightDefaults";
import { getQuickBuild } from "../../data/SquadronPresets";
import { seedRange } from "../skill/ArenaStats";
import { measureGate1Pair } from "../skill/SkillGates";
import {
  playerVersusDifficulty,
  playerVersusSkill,
  type CurveMode,
  type DifficultyLabel,
} from "./difficultyCurve";
import {
  aceSides,
  runDuelSeries,
  type DuelSeries,
  type DuelSide,
} from "./duelBalance";
import { classicPair, reinforcedPair, type PairResult } from "./factionMatrix";
import { measureShipValue, type ShipValue } from "./roleValue";
import { runScenarioSeries, type ScenarioSeries } from "./scenarioBalance";
import {
  BALANCE_FACTIONS,
  presetList,
  skirmishAutoFillList,
  SKIRMISH_POINT_LIMIT,
  type SquadList,
} from "./squadLists";
import type { WinTally } from "./balanceStats";

/** Seeds of a job: `count` consecutive seeds from `base`. */
export interface SeedBlock {
  readonly base: number;
  readonly count: number;
}

/** One unit of work. */
export type BalanceJob =
  | {
      readonly kind: "classic" | "reinforced" | "preset";
      readonly a: FactionId;
      readonly b: FactionId;
      readonly seeds: SeedBlock;
    }
  | {
      readonly kind: "shipValue";
      readonly definitionId: string;
      readonly seeds: SeedBlock;
    }
  | {
      readonly kind: "ace";
      readonly matchupId: string;
      readonly tier: BotTier;
      readonly abilities: boolean;
      readonly seeds: SeedBlock;
    }
  | {
      readonly kind: "dogfight";
      readonly tier: BotTier;
      readonly seeds: SeedBlock;
    }
  | {
      readonly kind: "difficulty";
      readonly mode: CurveMode;
      readonly label: DifficultyLabel;
      readonly seeds: SeedBlock;
    }
  | {
      readonly kind: "skill";
      readonly mode: CurveMode;
      readonly tier: BotTier;
      readonly reactionScale: number;
      readonly seeds: SeedBlock;
    }
  | {
      readonly kind: "duel";
      readonly side1: DuelSide;
      readonly side2: DuelSide;
      readonly tier: BotTier;
      readonly seeds: SeedBlock;
    }
  | {
      readonly kind: "squads";
      readonly a: SquadList;
      readonly b: SquadList;
      readonly seeds: SeedBlock;
    }
  | {
      readonly kind: "gate1";
      readonly expertShip: string;
      readonly noviceShip: string;
      readonly seeds: SeedBlock;
    }
  | {
      readonly kind: "scenario";
      readonly scenario: ScenarioId;
      readonly a: FactionId;
      readonly b: FactionId;
      readonly reinforced: boolean;
      readonly seeds: SeedBlock;
    };

/** What each job kind returns. */
export type BalanceJobResult =
  PairResult | ShipValue | DuelSeries | WinTally | ScenarioSeries;

/**
 * @param block - A seed block.
 * @returns Its seeds.
 */
export function seedsOf(block: SeedBlock): number[] {
  return seedRange(block.count, block.base);
}

/**
 * @param faction - A faction.
 * @returns Its 200-point quick-build preset as a list.
 */
export function presetListOf(faction: FactionId): SquadList {
  const preset = getQuickBuild(faction, SKIRMISH_POINT_LIMIT);
  if (!preset)
    throw new Error(`no ${SKIRMISH_POINT_LIMIT}-pt preset for ${faction}`);
  return presetList(preset);
}

/**
 * Run one job.
 * @param job - The job.
 * @returns Its result (JSON-safe).
 */
export function runBalanceJob(job: BalanceJob): BalanceJobResult {
  const seeds = seedsOf(job.seeds);
  switch (job.kind) {
    case "classic":
      return classicPair(
        skirmishAutoFillList(job.a),
        skirmishAutoFillList(job.b),
        seeds,
      );
    case "preset":
      return classicPair(presetListOf(job.a), presetListOf(job.b), seeds);
    case "reinforced":
      return reinforcedPair({
        a: skirmishAutoFillList(job.a),
        b: skirmishAutoFillList(job.b),
        seeds,
      });
    case "shipValue":
      return measureShipValue({
        definitionId: job.definitionId,
        references: BALANCE_FACTIONS.map((f) => skirmishAutoFillList(f)),
        seeds,
        budget: SKIRMISH_POINT_LIMIT,
      });
    case "ace":
      return aceJob(job.matchupId, job.tier, job.abilities, seeds);
    case "dogfight":
      return dogfightJob(job.tier, seeds);
    case "difficulty":
      return playerVersusDifficulty(job.mode, job.label, seeds);
    case "skill":
      return playerVersusSkill(
        job.mode,
        { tier: job.tier, reactionScale: job.reactionScale },
        seeds,
      );
    case "duel": {
      const skill = { tier: job.tier, reactionScale: 1 };
      return runDuelSeries({
        side1: job.side1,
        side2: job.side2,
        seeds,
        skill1: skill,
        skill2: skill,
      });
    }
    case "squads":
      return classicPair(job.a, job.b, seeds);
    case "gate1":
      return gate1Job(job.expertShip, job.noviceShip, job.seeds.count);
    case "scenario":
      return runScenarioSeries({
        scenario: job.scenario,
        listX: skirmishAutoFillList(job.a),
        listY: skirmishAutoFillList(job.b),
        seeds,
        reinforced: job.reinforced,
      });
  }
}

function aceJob(
  matchupId: string,
  tier: BotTier,
  abilities: boolean,
  seeds: readonly number[],
): DuelSeries {
  const matchup = ACE_MATCHUPS.find((m) => m.id === matchupId);
  if (!matchup) throw new Error(`unknown Ace Duel preset ${matchupId}`);
  const skill = { tier, reactionScale: 1 };
  return runDuelSeries({
    ...aceSides(matchup, abilities),
    seeds,
    skill1: skill,
    skill2: skill,
  });
}

function dogfightJob(tier: BotTier, seeds: readonly number[]): DuelSeries {
  const { player, enemy } = DOGFIGHT_DEFAULT_PAIRING;
  const skill = { tier, reactionScale: 1 };
  return runDuelSeries({
    side1: { ships: [player.shipId], kit: {} },
    side2: { ships: [enemy.shipId], kit: {} },
    seeds,
    skill1: skill,
    skill2: skill,
  });
}

/**
 * Skill gate 1 for one pair (the gate's own measurement: re-measured at
 * the confirm size when it dips below the threshold).
 * @param expertShip - The expert's hull.
 * @param noviceShip - The novice's hull.
 * @param seeds - Seeds of the first measurement.
 * @returns The expert's tally.
 */
function gate1Job(
  expertShip: string,
  noviceShip: string,
  seeds: number,
): WinTally {
  const { summary } = measureGate1Pair(
    { expertShip, noviceShip, priceRatio: 0 },
    seeds,
  );
  const games = summary.battles;
  const wins = Math.round(summary.winRate * games);
  const draws = Math.round(summary.drawRate * games);
  return { wins, draws, losses: games - wins - draws };
}
