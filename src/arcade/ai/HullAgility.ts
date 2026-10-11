/**
 * HullAgility — which hulls an AI pilot may fly red specials with.
 *
 * Pure: no Phaser.
 */

import {
  getMovementProfile,
  getShipDefinition,
} from "../../data/ShipDefinitions";

/**
 * Whether a hull may K-turn at all: capital hulls (capital movement profile
 * or capital role) never flip.
 *
 * @param definitionId - Ship definition id.
 * @returns False for capital hulls.
 */
export function canHullKTurn(definitionId: string): boolean {
  if (getMovementProfile(definitionId) === "capital") return false;
  return getShipDefinition(definitionId)?.role !== "capital";
}
