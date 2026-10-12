/**
 * Survival roguelite — the ships of one battle wave (pure), shared by
 * SurvivalScene and the headless node sim: the run's threat scaled by the
 * node plan (SurvivalRunController.scaledWaveSize), the node's extra
 * elites, and the boss on a boss node's last wave, each with its quick
 * build (planWaveRoster).
 *
 * A boss wave fields the boss alone: no bonus elite (the old endless mode
 * added one to every milestone wave; against a fleet of 1–2 ships it made
 * bosses a wall — ADR-0004 sweep) and no regulars. Ascension's elite
 * contracts go to elite nodes only.
 */

import {
  planWaveRoster,
  type WaveSlot,
} from "../../arcade/systems/SurvivalLoadouts";
import { SECTOR_COUNT } from "../../data/survival/sectors";
import { REGULARS_PER_EXTRA_ELITE } from "./CombatNodePlan";
import type { SurvivalBattleRules, WaveSpec } from "./SurvivalBattleRules";
import type { SurvivalRunController } from "./SurvivalRunController";

/**
 * Roles a node's elites are drawn from, by sector (most preferred first).
 * Gunship elites (156–192 hull ×1.5, 3+1 dice) against a starter wing were
 * a wall (8–16 % cleared in sector 1, ~40–55 % as sector-3 elites even after
 * the fairness pass — ADR-0004 sweep): sector 1 fields heavy fighters,
 * sector 2 heavy fighters / bombers, sector 3 bombers; gunships stay the
 * bosses' hull and only fill in for a faction without a bomber.
 */
export const ELITE_ROLES_BY_SECTOR: Readonly<
  Record<number, readonly string[]>
> = {
  1: ["heavy_fighter"],
  2: ["heavy_fighter", "bomber"],
  3: ["bomber", "gunship"],
};

/**
 * Regulars beside a sector boss. A boss flanked by even one regular is a
 * squad that marks its target (+hit, +damage); alone, its 2-ship opponent
 * cleared ~90 % instead of ~55 % in sector 1. The boss's phases still call
 * in reinforcements.
 */
export const BOSS_WAVE_REGULARS = 0;

/** What a wave needs to be sized. */
export interface NodeWaveInput {
  readonly rules: SurvivalBattleRules;
  readonly controller: SurvivalRunController;
  readonly spec: WaveSpec;
  /** Living player ships when the wave arrives. */
  readonly playerShips: number;
}

/**
 * @param input - The node's rules, the run controller, the wave and the fleet size.
 * @returns The wave's ships in spawn order (regulars, elites, boss).
 */
export function nodeWaveRoster(input: NodeWaveInput): WaveSlot[] {
  const { rules, controller, spec } = input;
  const plan = rules.plan;
  const size = controller.scaledWaveSize(
    input.playerShips,
    plan.threatMultiplier,
    plan.extraElites,
    plan.maxRegulars,
    REGULARS_PER_EXTRA_ELITE,
  );
  return planWaveRoster(rules.roster(spec.faction), {
    enemyCount: spec.isBossWave ? BOSS_WAVE_REGULARS : size.enemyCount,
    eliteCount: size.eliteCount,
    isMilestone: spec.isBossWave,
    eliteRoles:
      ELITE_ROLES_BY_SECTOR[plan.sector] ??
      ELITE_ROLES_BY_SECTOR[SECTOR_COUNT]!,
  });
}
