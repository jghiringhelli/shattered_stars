/**
 * nodeBattle — the state of a headless Survival node battle in progress
 * (shared by SurvivalNodeSim and nodeWaves).
 *
 * Pure data.
 */

import type { BeltConfig } from "../../systems/arena/ArenaBoundary";
import type { SurvivalBattleRules } from "../../systems/survival/SurvivalBattleRules";
import type { SurvivalRunController } from "../../systems/survival/SurvivalRunController";
import type { NodeCombat } from "./nodeCombat";
import type { NodeWeapons } from "./nodeWeapons";

/** Counts of what creatures did in a battle (tests, reports). */
export interface CreatureStats {
  telegraphs: number;
  powersLanded: number;
  partsDestroyed: number;
  hitsOnPlayers: number;
}

/** The battle in progress (mutable simulation state). */
export interface NodeBattle {
  readonly rules: SurvivalBattleRules;
  readonly controller: SurvivalRunController;
  readonly combat: NodeCombat;
  /** The belt as it stands (squeezes every wave). */
  belt: BeltConfig;
  /** Battle time (ms), intro included. */
  nowMs: number;
  /** When the next wave arrives, or null while one is being fought. */
  nextWaveAtMs: number | null;
  firstKillMs: number | null;
  /** Special actions flown by the player's ships. */
  specialsUsed: number;
  enemiesSpawned: number;
  /** Player ships the asteroid belt destroyed. */
  beltLosses: number;
  /** Whether the belt damages player ships (false: a belt-aware pilot). */
  readonly playerBeltDamage: boolean;
  /** Phases started per boss id. */
  readonly bossPhases: Map<string, number>;
  /** Every ship's secondaries (set right after the battle opens). */
  weapons: NodeWeapons | null;
  /** What the creatures did (tests, reports). */
  readonly creatureStats: CreatureStats;
  /** Battle time (ms) the boss arrived, or null while it has not. */
  bossAtMs: number | null;
}
