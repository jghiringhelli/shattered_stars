/**
 * builderMemory — maps the Squad Builder's state to and from what the game
 * remembers (setupMemory) and shares (squadShare): squads, point limit,
 * difficulty, map, flow and the Skirmish WINGMEN choice. Pure.
 */

import type { FactionId } from "../../config";
import { flownSquadCost, type SquadEntry } from "../../core/squadTypes";
import { SHIP_DEFINITIONS } from "../../data/ShipDefinitions";
import type { BuilderMemory, SquadMemory } from "../../systems/setup/setupMemory";
import type { SharedSquad } from "../../systems/setup/squadShare";
import type { WingmenType } from "../../systems/setup/wingmenTypes";

/** What the builder remembers between visits. */
export interface BuilderState {
  readonly pointLimit: number;
  readonly aiDifficulty: string;
  readonly simpleMode: boolean;
  readonly mapTheme: string;
  readonly wingmen: WingmenType;
  readonly customWingmen: readonly string[];
  readonly squads: readonly SquadEntry[];
}

function entryFromMemory(squad: SquadMemory): SquadEntry {
  const loadoutChoices = { ...squad.loadoutChoices };
  return {
    teamId: squad.teamId,
    factionId: squad.factionId as FactionId,
    controller: squad.controller === "player" ? "player" : "ai",
    ships: [...squad.ships],
    loadoutChoices,
    pointsUsed: flownSquadCost([...squad.ships], loadoutChoices),
  };
}

/**
 * @param memory - The remembered builder, or null on a first visit.
 * @returns Its squads, or null when there are none or any ship no longer exists.
 */
export function squadsFromMemory(memory: BuilderMemory | null): SquadEntry[] | null {
  const remembered = memory?.squads ?? [];
  const valid = remembered.every(
    (squad) => squad.ships.length > 0 && squad.ships.every((id) => SHIP_DEFINITIONS[id] !== undefined),
  );
  return valid && remembered.length > 0 ? remembered.map(entryFromMemory) : null;
}

/**
 * @param state - The builder's state at launch.
 * @returns The document to remember.
 */
export function builderMemoryOf(state: BuilderState): BuilderMemory {
  return {
    pointLimit: state.pointLimit,
    aiDifficulty: state.aiDifficulty,
    simpleMode: state.simpleMode,
    mapTheme: state.mapTheme,
    wingmen: state.wingmen,
    customWingmen: [...state.customWingmen],
    squads: state.squads.map((squad) => ({
      factionId: squad.factionId ?? "",
      controller: squad.controller,
      teamId: squad.teamId,
      ships: squad.ships,
      loadoutChoices: squad.loadoutChoices,
    })),
  };
}

/**
 * @param squads - The builder's squads.
 * @param wingmen - The WINGMEN choice that built the player's squad.
 * @returns The player's squad as a shareable value (null before one is built).
 */
export function sharedPlayerSquad(squads: readonly SquadEntry[], wingmen: WingmenType): SharedSquad | null {
  const squad = squads.find((s) => s.controller === "player");
  if (!squad?.factionId || squad.ships.length === 0) return null;
  return { factionId: squad.factionId, ships: squad.ships, loadoutChoices: squad.loadoutChoices, wingmen };
}
