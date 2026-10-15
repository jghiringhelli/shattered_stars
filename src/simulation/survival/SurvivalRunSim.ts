/**
 * SurvivalRunSim — a whole Survival roguelite run played headless through
 * the game's own pure run operations (createRun, enterNode, the event /
 * shop / dock / reward resolvers, completeCombat / failRun), every battle
 * node fought by {@link simulateNodeBattle}. An "average player" policy
 * picks the route (repairs when hurt, elites when healthy), rewards (the
 * generalist draft policy, the first relic / Hangar / mutation offered),
 * the first affordable event choice, and shop repairs / relics.
 *
 * Pure: no Phaser, no storage. Deterministic for a seed.
 */

import type { FactionId } from "../../config";
import { flagshipLoadout } from "../../arcade/systems/SurvivalLoadouts";
import { getEvent } from "../../data/survival/events";
import { SURVIVAL_STARTER_CHOICES } from "../../data/survival/starters";
import {
  completeCombat,
  failRun,
} from "../../systems/survival/CombatResolution";
import {
  choiceAvailability,
  resolveEventChoice,
} from "../../systems/survival/EventResolver";
import { dockOptions, useDock } from "../../systems/survival/RepairDock";
import { enterNode, finishNode } from "../../systems/survival/RunNavigation";
import { createRun } from "../../systems/survival/RunState";
import type { RunState } from "../../systems/survival/RunTypes";
import {
  nextOptions,
  type MapNode,
} from "../../systems/survival/SectorMapGenerator";
import { buyShopItem, shopStock } from "../../systems/survival/ShopService";
import { createSeededRng, type RandomGenerator } from "../../utils/random";
import { claimRewards } from "./runRewards";
import {
  simulateNodeBattle,
  type NodeBattleResult,
  type NodeSimOptions,
} from "./SurvivalNodeSim";

/** Hull fraction below which the player heads for repairs. */
export const REPAIR_THRESHOLD = 0.6;
/** Hull fraction above which the player takes elites on. */
export const ELITE_THRESHOLD = 0.75;
/** Salvage the player keeps in reserve before buying a shop relic. */
export const SHOP_RESERVE = 30;
/** Escorts the player hires in shops before buying relics. */
export const WANTED_ESCORTS = 2;
/** Safety cap on map steps (a run has 3 × 8 rows). */
const MAX_STEPS = 64;

/** Route weights of the average player, by node type. */
const ROUTE_WEIGHTS: Readonly<Record<string, number>> = {
  combat: 3,
  event: 2,
  mystery: 2,
  shop: 1,
  repair: 0.5,
  elite: 1,
  boss: 1,
};

/** A run to simulate. */
export interface RunSimOptions {
  readonly seed: number;
  readonly ascension?: number;
  readonly faction?: FactionId;
  /** Battle options (belt behaviour of the simulated player). */
  readonly node?: NodeSimOptions;
  /** Edits the fresh run (the balance sweeps force a relic, power or mutation). */
  readonly start?: (run: RunState) => RunState;
  /** Replaces the average player's reward claim. */
  readonly claim?: (run: RunState) => RunState;
}

/** One battle node of a run. */
export interface NodeRecord {
  readonly sector: number;
  readonly row: number;
  readonly kind: "combat" | "elite" | "boss";
  /** Flagship hull fraction entering the battle (damage persists). */
  readonly startHull: number;
  readonly battle: NodeBattleResult;
}

/** A simulated run. */
export interface RunSimResult {
  readonly seed: number;
  readonly won: boolean;
  readonly sectorReached: number;
  readonly battles: readonly NodeRecord[];
}

/**
 * Play a whole run.
 * @param options - Seed, ascension and faction.
 * @returns Every battle fought and whether the run was won.
 */
export function simulateSurvivalRun(options: RunSimOptions): RunSimResult {
  const faction = options.faction ?? "terran_hegemony";
  const flagshipId = SURVIVAL_STARTER_CHOICES[faction][0]!;
  let run = createRun({
    seed: options.seed,
    faction,
    flagshipId,
    loadoutId: flagshipLoadout(flagshipId, null),
    ascension: options.ascension ?? 0,
    unlocked: [],
    now: 0,
  });
  if (options.start) run = options.start(run);
  const rng = createSeededRng((options.seed ^ 0x2545f491) >>> 0);
  const battles: NodeRecord[] = [];
  const claim = options.claim ?? claimRewards;
  for (let step = 0; step < MAX_STEPS && run.status === "active"; step++) {
    run = claim(run);
    if (run.status !== "active") break;
    const reachable = nextOptions(run.map, run.currentNodeId);
    if (reachable.length === 0) break;
    run = enterNode(run, pickNode(run, reachable, rng).id);
    run = resolveNode(run, battles, options.node ?? {});
  }
  return {
    seed: options.seed,
    won: run.status === "victory",
    sectorReached: run.sector,
    battles,
  };
}

/**
 * @param run - The run.
 * @param options - Nodes reachable now.
 * @param rng - The policy's random source.
 * @returns The node the average player travels to.
 */
export function pickNode(
  run: RunState,
  options: readonly MapNode[],
  rng: RandomGenerator,
): MapNode {
  const hull = run.flagship.hull;
  const weightOf = (node: MapNode): number => {
    if (node.type === "repair" && hull < REPAIR_THRESHOLD) return 8;
    if (node.type === "shop" && hull < REPAIR_THRESHOLD) return 4;
    if (node.type === "elite" && hull < ELITE_THRESHOLD) return 0.1;
    return ROUTE_WEIGHTS[node.type] ?? 1;
  };
  const total = options.reduce((sum, n) => sum + weightOf(n), 0);
  let roll = rng.next() * total;
  for (const node of options) {
    roll -= weightOf(node);
    if (roll <= 0) return node;
  }
  return options[options.length - 1]!;
}

function resolveNode(
  run: RunState,
  battles: NodeRecord[],
  node: NodeSimOptions,
): RunState {
  switch (run.activeKind) {
    case "combat":
    case "elite":
    case "boss":
      return fight(run, battles, node);
    case "event":
      return resolveEvent(run, battles, node);
    case "shop":
      return finishNode(shop(run));
    case "repair":
      return finishNode(dock(run));
    default:
      return run.activeNodeId ? finishNode(run) : run;
  }
}

function fight(
  run: RunState,
  battles: NodeRecord[],
  node: NodeSimOptions,
): RunState {
  const kind = run.eventCombat
    ? run.eventCombat.elite
      ? "elite"
      : "combat"
    : (run.activeKind as NodeRecord["kind"]);
  const row = run.map.rows.findIndex((r) =>
    r.some((n) => n.id === run.activeNodeId),
  );
  const battle = simulateNodeBattle(run, node);
  battles.push({
    sector: run.sector,
    row: Math.max(0, row),
    kind,
    startHull: run.flagship.hull,
    battle,
  });
  if (battle.won) return completeCombat(run, battle.outcome);
  return failRun(
    run,
    `Destroyed in sector ${run.sector}`,
    battle.durationMs,
    battle.kills,
  );
}

function resolveEvent(
  run: RunState,
  battles: NodeRecord[],
  node: NodeSimOptions,
): RunState {
  const event = run.activeEventId ? getEvent(run.activeEventId) : undefined;
  if (!event) return finishNode(run);
  const index = event.choices.findIndex(
    (c) => choiceAvailability(run, c).enabled,
  );
  if (index < 0) return finishNode(run);
  const resolution = resolveEventChoice(run, event, index);
  return resolution.startsCombat
    ? fight(resolution.run, battles, node)
    : finishNode(resolution.run);
}

/** Items the average player buys in one shop visit (salvage permitting). */
const MAX_SHOP_PURCHASES = 4;

function shop(start: RunState): RunState {
  const nodeId = start.activeNodeId ?? "";
  let run = start;
  for (let bought = 0; bought < MAX_SHOP_PURCHASES; bought++) {
    const stock = shopStock(run, nodeId);
    const buy = (kind: string, keep = 0) =>
      stock.find(
        (i) => i.kind === kind && i.available && run.salvage - i.price >= keep,
      );
    const pick =
      (run.flagship.hull < REPAIR_THRESHOLD ? buy("repair") : undefined) ??
      (run.escorts.length < WANTED_ESCORTS ? buy("escort") : undefined) ??
      buy("upgrade", SHOP_RESERVE) ??
      buy("relic", SHOP_RESERVE);
    const next = pick ? buyShopItem(run, nodeId, pick.id) : null;
    if (!next) break;
    run = next;
  }
  return run;
}

function dock(run: RunState): RunState {
  const options = dockOptions(run);
  const upgrade = options.find((o) => o.id !== "repair" && o.enabled);
  const choice =
    run.flagship.hull < ELITE_THRESHOLD || !upgrade ? "repair" : upgrade.id;
  return useDock(run, choice);
}
