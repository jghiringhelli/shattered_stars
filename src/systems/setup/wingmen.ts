/**
 * wingmen — the Skirmish WINGMEN choice: what kind of squad flies with the
 * player. AUTO, SAME ROLE, FIGHTERS, STRIKERS and SUPPORT-HEAVY fill the
 * wingmen from the faction's roster within the point budget and the squad
 * rules (no capitals, at most MAX_SQUAD_SHIPS, unique pilots once, the
 * reinforcement quotas and field cap when that format is on). The fill is
 * deterministic from a seed. CUSTOM keeps the ships the player picked.
 * Pure: no Phaser.
 */

import { assignQuickBuilds } from "../../arcade/systems/QuickBuildEquip";
import type { QuotaRule, ShipCategory } from "../../arcade/reinforcements/reinforcementTypes";
import type { FactionId } from "../../config";
import { MAX_SQUAD_SHIPS, flownSquadCost, type GameMode } from "../../core/squadTypes";
import type { ShipRole } from "../../core/types";
import { SHIP_DEFINITIONS, getShipsByFaction } from "../../data/ShipDefinitions";
import { uniquePilotOf } from "../../data/squadRules";
import { createSeededRng } from "../../utils/random";
import { WINGMEN_TYPES, DEFAULT_WINGMEN, isWingmenType, type WingmenType } from "./wingmenTypes";

export { WINGMEN_TYPES, DEFAULT_WINGMEN, isWingmenType, type WingmenType };
/** Reinforcement-format limits the wingmen must respect. */
export interface WingmenRules {
  readonly quotas: readonly QuotaRule[];
  /** Points of living ships a side may field at once. */
  readonly fieldCapPoints: number;
}

/** What to fill. */
export interface WingmenRequest {
  readonly faction: FactionId;
  /** The ship the player flies (always first). */
  readonly shipId: string;
  /** The player's chosen quick build (null = default build). */
  readonly loadoutId: string | null;
  readonly type: WingmenType;
  readonly gameMode: GameMode;
  readonly pointLimit: number;
  /** Seed of the random choices (see {@link wingmenSeed}). */
  readonly seed: number;
  /** Set when the reinforcement format is on. */
  readonly rules?: WingmenRules | undefined;
  /** CUSTOM: the wingmen the player picked (after the flagship). */
  readonly custom?: readonly string[];
  /** CUSTOM: builds of those wingmen keyed by their index in `custom`. */
  readonly customLoadouts?: Readonly<Record<string, string>>;
}

/** The squad that flies: flagship first, then wingmen. */
export interface WingmenPlan {
  readonly ships: string[];
  readonly loadoutChoices: Record<string, string>;
  /** Flown cost of the whole squad. */
  readonly pointsUsed: number;
}

type RoleWeights = ReadonlyArray<readonly [ShipRole, number]>;

/** Roles each filling type recruits, in tie-break order, with their share. */
const ROLE_WEIGHTS: Readonly<Record<"auto" | "fighters" | "strikers" | "support_heavy", RoleWeights>> = {
  auto: [
    ["heavy_fighter", 1],
    ["interceptor", 1],
    ["gunship", 1],
    ["support", 1],
    ["light_fighter", 1],
    ["bomber", 1],
  ],
  fighters: [
    ["heavy_fighter", 1],
    ["interceptor", 1],
    ["light_fighter", 1],
  ],
  strikers: [
    ["gunship", 1],
    ["bomber", 1],
  ],
  support_heavy: [
    ["support", 2],
    ["heavy_fighter", 1],
    ["interceptor", 1],
    ["gunship", 1],
    ["light_fighter", 1],
  ],
};

/**
 * @param faction - Faction id.
 * @param shipId - The flagship.
 * @param type - Wingmen type.
 * @param pointLimit - Point limit.
 * @param reroll - How many times the player pressed SHUFFLE.
 * @returns A stable seed: the same setup always fills the same wingmen.
 */
export function wingmenSeed(
  faction: string,
  shipId: string,
  type: WingmenType,
  pointLimit: number,
  reroll: number,
): number {
  let hash = 0x811c9dc5;
  for (const char of `${faction}|${shipId}|${type}|${pointLimit}|${reroll}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  }
  return hash >>> 0;
}

function loadoutsOf(request: WingmenRequest): Record<string, string> {
  return request.loadoutId ? { "0": request.loadoutId } : {};
}

function categoryCounts(ships: readonly string[], loadoutChoices: Readonly<Record<string, string>>): Record<ShipCategory, number> {
  const builds = assignQuickBuilds(
    ships,
    ships.map((_, index) => loadoutChoices[String(index)]),
  );
  const counts: Record<ShipCategory, number> = { bomber: 0, ace: 0, capital: 0 };
  ships.forEach((id, index) => {
    const def = SHIP_DEFINITIONS[id];
    if (def?.role === "bomber") counts.bomber += 1;
    if (uniquePilotOf(builds[index] ?? null)) counts.ace += 1;
    if (def?.role === "capital" || def?.baseStats.size === "huge") counts.capital += 1;
  });
  return counts;
}

/** @returns Whether a squad keeps every quota it did not already break. */
function withinQuotas(
  before: Record<ShipCategory, number>,
  after: Record<ShipCategory, number>,
  quotas: readonly QuotaRule[],
): boolean {
  return quotas.every(
    (quota) => after[quota.category] <= quota.maxOnField || after[quota.category] <= before[quota.category],
  );
}

/** Roles a type recruits from, with weights (SAME ROLE follows the flagship). */
function weightsFor(request: WingmenRequest): RoleWeights {
  if (request.type === "same_role") {
    const role = SHIP_DEFINITIONS[request.shipId]?.role;
    return role ? [[role, 1]] : [];
  }
  if (request.type === "custom") return [];
  return ROLE_WEIGHTS[request.type];
}

/** Roles ordered by how far below their share they are (neediest first). */
function neediestRoles(weights: RoleWeights, ships: readonly string[]): ShipRole[] {
  const count = (role: ShipRole): number => ships.filter((id) => SHIP_DEFINITIONS[id]?.role === role).length;
  return weights
    .map(([role, weight], order) => ({ role, order, score: (count(role) + 1) / weight }))
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .map((entry) => entry.role);
}

function fillWingmen(request: WingmenRequest): WingmenPlan {
  const loadoutChoices = loadoutsOf(request);
  const ships = [request.shipId];
  const weights = weightsFor(request);
  const budget = Math.min(request.pointLimit, request.rules?.fieldCapPoints ?? Number.POSITIVE_INFINITY);
  const roster = getShipsByFaction(request.faction).filter(
    (s) => request.gameMode === "epic" || (s.role !== "capital" && s.baseStats.size !== "huge"),
  );
  const random = createSeededRng(request.seed);
  const fits = (id: string): boolean => {
    const next = [...ships, id];
    if (next.length > MAX_SQUAD_SHIPS || flownSquadCost(next, loadoutChoices) > budget) return false;
    if (!request.rules) return true;
    return withinQuotas(
      categoryCounts(ships, loadoutChoices),
      categoryCounts(next, loadoutChoices),
      request.rules.quotas,
    );
  };
  while (ships.length < MAX_SQUAD_SHIPS) {
    const pick = neediestRoles(weights, ships)
      .map((role) => roster.filter((s) => s.role === role && fits(s.id)))
      .find((affordable) => affordable.length > 0);
    if (!pick) break;
    const distinct = pick.filter((s) => !ships.includes(s.id));
    ships.push(random.pick(distinct.length > 0 ? distinct : pick)!.id);
  }
  return { ships, loadoutChoices, pointsUsed: flownSquadCost(ships, loadoutChoices) };
}

function keepCustom(request: WingmenRequest): WingmenPlan {
  const loadoutChoices = loadoutsOf(request);
  const ships = [request.shipId, ...(request.custom ?? [])];
  Object.entries(request.customLoadouts ?? {}).forEach(([index, id]) => {
    if (Number(index) + 1 < ships.length) loadoutChoices[String(Number(index) + 1)] = id;
  });
  while (ships.length > 1 && (ships.length > MAX_SQUAD_SHIPS || flownSquadCost(ships, loadoutChoices) > request.pointLimit)) {
    delete loadoutChoices[String(ships.length - 1)];
    ships.pop();
  }
  return { ships, loadoutChoices, pointsUsed: flownSquadCost(ships, loadoutChoices) };
}

/**
 * Builds the squad that flies with the player.
 *
 * @param request - Faction, flagship, wingmen type, budget, seed and rules.
 * @returns The ships (flagship first), their builds and the flown cost; never over the budget
 *   unless the flagship alone is.
 */
export function planWingmen(request: WingmenRequest): WingmenPlan {
  return request.type === "custom" ? keepCustom(request) : fillWingmen(request);
}
