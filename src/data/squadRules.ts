/**
 * Squad-level rules for quick-build rosters.
 *
 * X-Wing's uniqueness rule: a named (unique) pilot can appear at most once in a
 * squad. Since every loadout names its pilot, a roster is a list of loadout ids
 * (null = the bare ship flown by a rookie, which is never unique).
 */

import { getLoadoutById } from "./ShipLoadouts";
import { PILOT_CARDS } from "../systems/SquadBuilder";

/**
 * The unique pilot a loadout fields, if any.
 *
 * @param loadoutId - A SHIP_LOADOUTS id, or null for the bare ship.
 * @returns The unique pilot's id, or null when the pilot is generic.
 */
export function uniquePilotOf(loadoutId: string | null): string | null {
  if (!loadoutId) return null;
  const pilotId = getLoadoutById(loadoutId)?.pilotId;
  return pilotId && PILOT_CARDS[pilotId]?.isUnique ? pilotId : null;
}

/**
 * Whether adding a loadout would field a unique pilot the roster already has.
 *
 * @param rosterLoadoutIds - Loadouts already in the squad.
 * @param loadoutId - The loadout about to be added.
 * @returns True when the addition breaks the uniqueness rule.
 */
export function wouldDuplicateUniquePilot(
  rosterLoadoutIds: ReadonlyArray<string | null>,
  loadoutId: string | null,
): boolean {
  const pilotId = uniquePilotOf(loadoutId);
  if (!pilotId) return false;
  return rosterLoadoutIds.some((id) => uniquePilotOf(id) === pilotId);
}
