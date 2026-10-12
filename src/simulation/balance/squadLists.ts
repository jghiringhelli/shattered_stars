/**
 * squadLists — the squads the balance harness fights with, built the way
 * the game builds them: the Skirmish auto-fill (what the AI opponent and
 * the simple flow's wingmen fly), the curated quick-build presets, mono-hull
 * squads for value-per-point sweeps — each ship on the quick build it flies
 * in battle (the chosen one, else assignQuickBuilds' default) and priced at
 * that build's cost.
 *
 * Pure (reads the static data).
 */

import type { FactionId } from "../../config";
import { autoFillSquad, makeSquad } from "../../core/squadTypes";
import { assignQuickBuilds } from "../../arcade/systems/QuickBuildEquip";
import { getShipDefinition } from "../../data/ShipDefinitions";
import { getLoadoutById } from "../../data/ShipLoadouts";
import type { QuickBuildSquad } from "../../data/SquadronPresets";
import type { SideSpec } from "../skill/ArenaSpec";
import type { SideSkill } from "../arenaLoop";

/** Every faction, in roster order. */
export const BALANCE_FACTIONS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

/** Short faction labels for tables. */
export const FACTION_SHORT: Readonly<Record<FactionId, string>> = {
  terran_hegemony: "TH",
  free_confederation: "FC",
  synthetic_collective: "SC",
  void_corsairs: "VC",
  ascendant_empire: "AE",
};

/** Skirmish squad budget (points). */
export const SKIRMISH_POINT_LIMIT = 200;

/** The Squad Builder's mode for Skirmish (capital ships excluded). */
const SKIRMISH_MODE = "arcade";

/** One ship of a list, on the build it flies. */
export interface ListShip {
  readonly definitionId: string;
  readonly loadoutId: string | null;
}

/** A squad as the harness fields it. */
export interface SquadList {
  readonly label: string;
  readonly faction: FactionId;
  readonly ships: readonly ListShip[];
}

/**
 * @param definitionIds - Hulls in squad order.
 * @param chosen - Builds already picked (by index), if any.
 * @returns Each hull on its chosen or default quick build.
 */
export function withQuickBuilds(
  definitionIds: readonly string[],
  chosen: readonly (string | null | undefined)[] = [],
): ListShip[] {
  const builds = assignQuickBuilds(definitionIds, chosen);
  return definitionIds.map((definitionId, i) => ({
    definitionId,
    loadoutId: builds[i] ?? null,
  }));
}

/**
 * @param ship - A list ship.
 * @returns What it costs: its build's price, else the bare hull's.
 */
export function shipCost(ship: ListShip): number {
  const loadout = ship.loadoutId ? getLoadoutById(ship.loadoutId) : undefined;
  return (
    loadout?.pointCost ??
    getShipDefinition(ship.definitionId)?.baseStats.pointCost ??
    0
  );
}

/**
 * @param list - A squad.
 * @returns Its total cost.
 */
export function listCost(list: SquadList): number {
  return list.ships.reduce((sum, ship) => sum + shipCost(ship), 0);
}

/**
 * The squad the Skirmish AI fields for a faction (autoFillSquad), each
 * ship on its default quick build as ArcadeBattleScene equips it.
 * @param faction - The faction.
 * @param pointLimit - Budget (Skirmish: 200).
 * @returns The list.
 */
export function skirmishAutoFillList(
  faction: FactionId,
  pointLimit: number = SKIRMISH_POINT_LIMIT,
): SquadList {
  const squad = makeSquad(2, 0, "ai");
  squad.factionId = faction;
  autoFillSquad(squad, SKIRMISH_MODE, pointLimit);
  return {
    label: `${FACTION_SHORT[faction]} auto-fill`,
    faction,
    ships: withQuickBuilds(
      squad.ships,
      squad.ships.map((_, i) => squad.loadoutChoices[String(i)]),
    ),
  };
}

/**
 * @param preset - A curated quick-build squad.
 * @returns It as a list.
 */
export function presetList(preset: QuickBuildSquad): SquadList {
  return {
    label: preset.name,
    faction: preset.factionId,
    ships: preset.ships.map((ship) => ({
      definitionId: getLoadoutById(ship.loadoutId)?.shipId ?? ship.loadoutId,
      loadoutId: ship.loadoutId,
    })),
  };
}

/**
 * @param definitionId - A hull.
 * @param copies - How many.
 * @param loadoutId - Their build (null = bare).
 * @returns A mono-hull squad.
 */
export function monoList(
  definitionId: string,
  copies: number,
  loadoutId: string | null = null,
): SquadList {
  const def = getShipDefinition(definitionId);
  return {
    label: `${copies}× ${def?.name ?? definitionId}`,
    faction: def?.faction ?? "free_confederation",
    ships: Array.from({ length: copies }, () => ({ definitionId, loadoutId })),
  };
}

/**
 * @param list - A squad.
 * @param skill - Its pilots' tier and reaction.
 * @returns The arena side (squad layer on).
 */
export function sideOf(list: SquadList, skill: SideSkill): SideSpec {
  return {
    ships: list.ships.map((ship) => ({
      definitionId: ship.definitionId,
      loadoutId: ship.loadoutId,
      tier: skill.tier,
      reactionScale: skill.reactionScale,
    })),
    squad: {},
  };
}
