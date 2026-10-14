/**
 * ScenarioMatchSim — one headless classic Scenario-mode match with bots on
 * both sides, on the skill arena's real engine (arenaLoop: BotPilot through
 * the player's controls, SquadCommand orders + marks, CycleFlight, own
 * repair and faction auras, secondaries, the arena's dice combat under the
 * CombatTempo round model) and the Scenario mode's own layers exactly as
 * the Skirmish scene wires them (scenarioRun). Arena combat is the
 * continuous-mode dice model, so kill rates approximate Skirmish's
 * projectile lasers. Reinforced scenarios run in ReinforcedBattleSim.
 *
 * Pure: no Phaser.
 */

import type { BotTier } from "../arcade/ai/BotTypes";
import {
  SCENARIO_DEFINITIONS,
  type ScenarioDefinition,
  type ScenarioId,
  type ScenarioResult,
} from "../arcade/scenarios";
import { assignQuickBuilds } from "../arcade/systems/QuickBuildEquip";
import { createArenaLoop, stepArenaLoop } from "./arenaLoop";
import {
  createScenarioRun,
  deployOnScenarioLines,
  directScenario,
  scenarioHooks,
  scoreScenario,
} from "./scenarioRun";
import type { BattleSpec, SideSpec } from "./skill/ArenaSpec";
import type { SideTally } from "./skill/ArenaCombatState";
import type { SideId } from "./skill/ArenaSide";

/** The player's default list in measured scenarios (Free Confederation). */
export const SCENARIO_PLAYER_LIST: readonly string[] = [
  "confed_kestrel",
  "confed_falcon",
  "confed_eagle",
  "confed_wasp",
];
/** The enemy's default list (Void Corsairs). */
export const SCENARIO_ENEMY_LIST: readonly string[] = [
  "corsair_blade",
  "corsair_talon",
  "corsair_marauder",
  "corsair_venom",
];

/** Pilots (and optionally lists) of the player's side (A) and the enemy's (B). */
export interface ScenarioTiers {
  readonly player: BotTier;
  readonly enemy: BotTier;
  /** Reaction multipliers (Brutal 0.5); default 1. */
  readonly playerReaction?: number;
  readonly enemyReaction?: number;
  /** Hulls of each side; default the FC / VC lists above. */
  readonly playerList?: readonly string[];
  readonly enemyList?: readonly string[];
  /** Quick builds of each list (by index); omitted = the default builds. */
  readonly playerBuilds?: readonly (string | null)[];
  readonly enemyBuilds?: readonly (string | null)[];
}

/** One measured match. */
export interface ScenarioMatch {
  readonly scenario: ScenarioId;
  readonly seed: number;
  readonly result: ScenarioResult;
  readonly pickups: number;
  /** Real time of the first kill (ms), or null. */
  readonly firstKillMs: number | null;
  readonly specialsUsed: number;
  readonly tallies: Readonly<Record<SideId, SideTally>>;
}

const AVERAGE_TIERS: ScenarioTiers = { player: "average", enemy: "average" };

function sideSpec(
  ids: readonly string[],
  tier: BotTier,
  reactionScale: number,
  chosen: readonly (string | null)[] = [],
): SideSpec {
  const builds = assignQuickBuilds(ids, chosen);
  return {
    ships: ids.map((definitionId, i) => ({
      definitionId,
      loadoutId: builds[i] ?? null,
      tier,
      reactionScale,
    })),
    squad: {},
  };
}

function spec(seed: number, tiers: ScenarioTiers): BattleSpec {
  return {
    A: sideSpec(
      tiers.playerList ?? SCENARIO_PLAYER_LIST,
      tiers.player,
      tiers.playerReaction ?? 1,
      tiers.playerBuilds,
    ),
    B: sideSpec(
      tiers.enemyList ?? SCENARIO_ENEMY_LIST,
      tiers.enemy,
      tiers.enemyReaction ?? 1,
      tiers.enemyBuilds,
    ),
    seed,
  };
}

/**
 * Play one classic scenario to its result.
 *
 * @param scenario - Scenario id.
 * @param seed - Battle seed.
 * @param tiers - Pilots (and lists) per side; average v average by default.
 * @param definition - The scenario's rules (default: the classic definition).
 * @returns The result and the match's combat stats.
 */
export function runScenarioMatch(
  scenario: ScenarioId,
  seed: number,
  tiers: ScenarioTiers = AVERAGE_TIERS,
  definition: ScenarioDefinition = SCENARIO_DEFINITIONS[scenario],
): ScenarioMatch {
  const loop = createArenaLoop(spec(seed, tiers));
  deployOnScenarioLines(loop.ships);
  const run = createScenarioRun(definition);
  const hooks = scenarioHooks(run);
  while (!run.state.result) {
    directScenario(run, loop);
    stepArenaLoop(loop, hooks);
    scoreScenario(run, loop);
  }
  return {
    scenario,
    seed,
    result: run.state.result,
    pickups: run.pickups,
    firstKillMs: loop.combat.firstKillAtMs ?? null,
    specialsUsed: loop.ships.reduce((sum, s) => sum + s.specialsUsed, 0),
    tallies: loop.combat.tallies,
  };
}
