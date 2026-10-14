/**
 * idLabels — player-facing names for ids that used to be shown by
 * rewording the id ("terran_imperator" → "terran imperator"). Ids are
 * internal; the catalog names are the lore-approved display text.
 */

import { getShipDefinition } from "../data/ShipDefinitions";
import { PILOT_ABILITIES } from "../systems/PilotAbilities";

/**
 * @param id - Snake-case id.
 * @returns The id reworded as lower-case words ("heavy_fighter" → "heavy fighter").
 */
function idWords(id: string): string {
  return id.replace(/_/g, " ");
}

/**
 * @param shipId - Ship definition id.
 * @returns The ship's display name, or its reworded id when unknown.
 */
export function shipDisplayName(shipId: string): string {
  return getShipDefinition(shipId)?.name ?? idWords(shipId);
}

/**
 * @param abilityId - Pilot ability id.
 * @returns The ability's display name, or its reworded id when unknown.
 */
export function abilityDisplayName(abilityId: string): string {
  return PILOT_ABILITIES[abilityId]?.name ?? idWords(abilityId);
}