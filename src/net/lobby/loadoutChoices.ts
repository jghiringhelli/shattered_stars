/**
 * loadoutChoices — what a player can bring online: a faction and either one
 * ship (Dogfight) or a squad (team modes: the squad built in the Squad
 * Builder when its faction matches, else the faction's default squad).
 * Pure (reads static ship data).
 */

import type { FactionId } from "../../config";
import {
  getShipDefinition,
  getShipsByFaction,
} from "../../data/ShipDefinitions";
import {
  ALL_FACTIONS,
  defaultShipsForFaction,
  FACTION_NAMES,
} from "../../ui/lobby/lobbyData";
import { MODE_RULES, type Loadout, type MatchMode } from "../protocol";

/** A squad saved by the Squad Builder (registry `onlineFaction` / `onlineSquad`). */
export interface SavedSquad {
  readonly faction: string;
  readonly ships: readonly string[];
}

/**
 * @param faction - A faction.
 * @returns Ships a pilot may fly online for it (no capital ships).
 */
export function onlineShipChoices(faction: FactionId): string[] {
  return getShipsByFaction(faction)
    .filter((ship) => ship.role !== "capital" && ship.baseStats.size !== "huge")
    .map((ship) => ship.id);
}

/**
 * @param mode - Match mode.
 * @param faction - Chosen faction.
 * @param saved - The Squad Builder's squad, if any.
 * @returns A legal loadout for the mode.
 */
export function defaultLoadout(
  mode: MatchMode,
  faction: FactionId,
  saved?: SavedSquad | null,
): Loadout {
  const rules = MODE_RULES[mode];
  if (rules.maxShips === 1)
    return {
      faction,
      ships: [
        onlineShipChoices(faction)[0] ??
          defaultShipsForFaction(faction)[0] ??
          "",
      ],
    };
  const squad =
    saved && saved.faction === faction && saved.ships.length > 0
      ? [...saved.ships]
      : defaultShipsForFaction(faction);
  return { faction, ships: squad.slice(0, rules.maxShips) };
}

/**
 * @param mode - Match mode.
 * @param current - Current loadout (null picks the first faction).
 * @param step - +1 next faction, -1 previous.
 * @param saved - The Squad Builder's squad, if any.
 * @returns The loadout for the neighbouring faction.
 */
export function cycleFaction(
  mode: MatchMode,
  current: Loadout | null,
  step: 1 | -1,
  saved?: SavedSquad | null,
): Loadout {
  const index = current
    ? ALL_FACTIONS.indexOf(current.faction as FactionId)
    : -1;
  const next = ALL_FACTIONS[
    (index + step + ALL_FACTIONS.length) % ALL_FACTIONS.length
  ] as FactionId;
  return defaultLoadout(mode, next, saved);
}

/**
 * @param current - A one-ship loadout.
 * @param step - +1 next ship, -1 previous.
 * @returns The loadout with the neighbouring ship of the same faction.
 */
export function cycleShip(current: Loadout, step: 1 | -1): Loadout {
  const choices = onlineShipChoices(current.faction as FactionId);
  if (choices.length === 0) return current;
  const index = choices.indexOf(current.ships[0] ?? "");
  const next =
    choices[(index + step + choices.length) % choices.length] ??
    current.ships[0] ??
    "";
  return { faction: current.faction, ships: [next] };
}

/** @param loadout - A loadout. @returns "Free Confederation · Falcon" or "… · Falcon +2". */
export function describeLoadout(loadout: Loadout | null): string {
  if (!loadout) return "No ship picked";
  const faction =
    FACTION_NAMES[loadout.faction as FactionId] ?? loadout.faction;
  const lead =
    getShipDefinition(loadout.ships[0] ?? "")?.name ?? loadout.ships[0] ?? "?";
  const extra = loadout.ships.length > 1 ? ` +${loadout.ships.length - 1}` : "";
  return `${faction} · ${lead}${extra}`;
}
