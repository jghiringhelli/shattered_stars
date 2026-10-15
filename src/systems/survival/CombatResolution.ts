/**
 * Survival roguelite — closing a battle node (pure). Writes the surviving
 * fleet back into the run (hull damage persists; shields partly recover),
 * banks kills and salvage, queues the node's rewards, and detects defeat
 * and victory.
 */

import {
  NODE_CLEAR_SALVAGE,
  RECOVERY_TUNING,
} from "../../data/survival/economy";
import { MUTATION_SLOT_BY_SECTOR } from "../../data/survival/mutations";
import { relicsOf } from "../../data/survival/relicCatalog";
import { SECTOR_COUNT } from "../../data/survival/sectors";
import { applyOutcomes } from "./EventResolver";
import { gainSalvage } from "./RunEconomy";
import { finishNode } from "./RunNavigation";
import { withFleet, withLog } from "./RunState";
import { combatKindOf, type CombatKind } from "./CombatNodePlan";
import type { PendingReward, RunState, ShipRecord } from "./RunTypes";

/** What a finished battle reports back. */
export interface CombatOutcome {
  /** Surviving player ships, flagship first (hull/shields as fractions). */
  readonly survivors: readonly ShipRecord[];
  readonly kills: number;
  readonly elitesKilled: number;
  readonly bossesKilled: number;
  /** Raw kill salvage (RunEconomy.killSalvage per kill, before ascension). */
  readonly killSalvage: number;
  /** Waves the run controller advanced (progression level after the battle). */
  readonly progressionLevel: number;
  readonly durationMs: number;
}

/**
 * @param run - The run with an active battle.
 * @param outcome - The battle's result (at least one survivor).
 * @returns The run back on the map with rewards queued, or ended in
 *   victory after the final boss.
 */
export function completeCombat(
  run: RunState,
  outcome: CombatOutcome,
): RunState {
  const kind = combatKindOf(run) ?? "combat";
  const bonus = run.eventCombat?.bonus ?? [];
  let next = recordBattle(run, outcome);
  next = withFleet(next, recoverFleet(next, outcome.survivors));
  next = gainSalvage(
    next,
    outcome.killSalvage + (NODE_CLEAR_SALVAGE[kind] ?? 0),
  );
  next = applyOutcomes(next, bonus, `${run.activeNodeId ?? "event"}:bonus`);
  const rewardKey = run.activeNodeId ?? `sector${run.sector}`;
  next = finishNode(next);
  if (kind === "boss" && run.sector >= SECTOR_COUNT) {
    return withLog(
      { ...next, status: "victory", cause: "Defeated the Nexus flagship" },
      "VICTORY",
    );
  }
  return {
    ...next,
    pendingRewards: [
      ...next.pendingRewards,
      ...rewardsFor(kind, run.sector, rewardKey),
    ],
  };
}

function recordBattle(run: RunState, outcome: CombatOutcome): RunState {
  const lost = Math.max(0, run.escorts.length + 1 - outcome.survivors.length);
  return {
    ...run,
    progression: { ...run.progression, level: outcome.progressionLevel },
    stats: {
      ...run.stats,
      kills: run.stats.kills + outcome.kills,
      elitesKilled: run.stats.elitesKilled + outcome.elitesKilled,
      bossesKilled: run.stats.bossesKilled + outcome.bossesKilled,
      escortsLost: run.stats.escortsLost + lost,
      elapsedMs: run.stats.elapsedMs + outcome.durationMs,
    },
  };
}

/**
 * Survivors' shields recover part of what they lost; Nanite-style relics
 * repair a share of hull after every cleared battle.
 */
function recoverFleet(
  run: RunState,
  survivors: readonly ShipRecord[],
): ShipRecord[] {
  const repair = relicsOf(run.relics)
    .flatMap((r) => r.effects)
    .reduce((sum, e) => sum + (e.kind === "nodeRepair" ? e.fraction : 0), 0);
  return survivors.map((ship) => ({
    ...ship,
    hull: Math.min(1, ship.hull + repair + RECOVERY_TUNING.nodeRepair),
    shields: Math.min(
      1,
      ship.shields + (1 - ship.shields) * RECOVERY_TUNING.shieldRecovery,
    ),
  }));
}

/**
 * @param kind - The battle kind.
 * @param sector - The sector it was fought in.
 * @param key - Stable key for the reward draws.
 * @returns The rewards it grants, in claim order.
 */
export function rewardsFor(
  kind: CombatKind,
  sector: number,
  key: string,
): PendingReward[] {
  if (kind === "combat") return [{ kind: "power", key }];
  if (kind === "elite") {
    return [
      { kind: "relic", key, minRarity: "uncommon" },
      { kind: "power", key },
    ];
  }
  const rewards: PendingReward[] = [
    { kind: "relic", key, minRarity: "rare" },
    { kind: "hangar" },
  ];
  const slot = MUTATION_SLOT_BY_SECTOR[sector];
  if (slot) rewards.push({ kind: "mutation", slot });
  rewards.push({ kind: "nextSector" });
  return rewards;
}

/**
 * @param run - The run.
 * @param cause - What destroyed the fleet.
 * @param durationMs - Time spent in the fatal battle.
 * @param kills - Kills scored in it.
 * @returns The run ended in defeat.
 */
export function failRun(
  run: RunState,
  cause: string,
  durationMs: number,
  kills: number,
): RunState {
  return withLog(
    {
      ...run,
      status: "defeat",
      cause,
      stats: {
        ...run.stats,
        kills: run.stats.kills + kills,
        elapsedMs: run.stats.elapsedMs + durationMs,
      },
    },
    `Defeat: ${cause}`,
  );
}
