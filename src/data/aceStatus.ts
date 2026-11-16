/**
 * aceStatus — who counts as an ACE (see aceConfig): a named pilot card with
 * a signature ability and initiative of at least ACE_MIN_INITIATIVE. The one
 * predicate every mode, the AI and the balance harness share.
 *
 * Pure (reads the static data).
 */

import { PILOT_CARDS, type PilotCard } from "../systems/SquadBuilder";
import { ACE_MIN_INITIATIVE } from "./aceConfig";
import { getLoadoutById } from "./ShipLoadouts";

/**
 * @param card - A pilot card, or undefined for no pilot.
 * @returns Whether it is an ace: unique, with an ability, initiative high enough.
 */
export function isAcePilotCard(card: PilotCard | undefined): boolean {
  return (
    card !== undefined &&
    card.isUnique &&
    card.abilityId !== undefined &&
    card.initiative >= ACE_MIN_INITIATIVE
  );
}

/**
 * @param loadoutId - A quick build id, or null for the bare ship.
 * @returns Whether the pilot flying that build is an ace.
 */
export function isAceLoadout(loadoutId: string | null | undefined): boolean {
  if (!loadoutId) return false;
  const pilotId = getLoadoutById(loadoutId)?.pilotId;
  return pilotId !== undefined && isAcePilotCard(PILOT_CARDS[pilotId]);
}
