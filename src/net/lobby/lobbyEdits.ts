/**
 * lobbyEdits — pure decisions behind the room controls: the loadout to send
 * when a player is seated without one (or comes back from the Squad Builder
 * with a new squad), the next scenario, the other team.
 */

import { SCENARIO_IDS } from "../../arcade/scenarios";
import type { FactionId } from "../../config";
import { MODE_RULES, type Loadout, type TeamId } from "../protocol";
import { localPlayer, type LobbyState } from "./LobbyModel";
import { defaultLoadout, type SavedSquad } from "./loadoutChoices";

/** Faction a new pilot starts with when nothing was saved. */
const DEFAULT_FACTION: FactionId = "free_confederation";

/**
 * @param state - Lobby state.
 * @param saved - The Squad Builder's squad, if any.
 * @returns A loadout to send now (seated without one, or a newer saved squad in a team mode), else null.
 */
export function pendingLoadout(
  state: LobbyState,
  saved: SavedSquad | null,
): Loadout | null {
  const me = localPlayer(state);
  const room = state.room;
  if (!me || !room || room.phase === "playing") return null;
  const faction = (saved?.faction ??
    me.loadout?.faction ??
    DEFAULT_FACTION) as FactionId;
  if (!me.loadout) return defaultLoadout(room.mode, faction, saved);
  if (
    MODE_RULES[room.mode].maxShips === 1 ||
    !saved ||
    saved.faction !== me.loadout.faction
  )
    return null;
  const wanted = defaultLoadout(room.mode, faction, saved);
  return sameShips(wanted.ships, me.loadout.ships) ? null : wanted;
}

/** @param current - Current scenario id (or none). @returns The next scenario id. */
export function nextScenario(current: string | undefined): string {
  const index = current
    ? SCENARIO_IDS.indexOf(current as (typeof SCENARIO_IDS)[number])
    : -1;
  return SCENARIO_IDS[(index + 1) % SCENARIO_IDS.length] ?? "";
}

/** @param team - Current team. @returns The other team. */
export function otherTeam(team: TeamId): TeamId {
  return team === 0 ? 1 : 0;
}

function sameShips(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
