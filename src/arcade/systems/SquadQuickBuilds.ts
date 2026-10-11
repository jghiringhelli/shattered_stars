/**
 * SquadQuickBuilds — quick builds for a squad configured in the squad
 * builder: the loadouts chosen there (keyed by ship index) are kept, every
 * other ship gets a default one that never repeats a unique pilot.
 *
 * Pure.
 */

import { assignQuickBuilds } from "./QuickBuildEquip";

/** Loadout ids chosen in the squad builder, keyed by ship index ("0", "1", …). */
export type LoadoutChoices = Readonly<Record<string, string>>;

/**
 * One loadout per squad ship: the chosen one, or a default quick build.
 *
 * @param shipIds - Ship definition ids, in squad order.
 * @param loadoutChoices - Loadouts chosen in the squad builder, by ship index.
 * @returns One loadout id per ship, or null when the ship has none.
 */
export function squadQuickBuilds(
  shipIds: readonly string[],
  loadoutChoices: LoadoutChoices = {},
): (string | null)[] {
  const chosen = shipIds.map((_, index) => loadoutChoices[String(index)]);
  return assignQuickBuilds(shipIds, chosen);
}
