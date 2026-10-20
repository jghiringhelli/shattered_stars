/**
 * squadRules — which squads may fly an online match. The relay validates
 * every loadout with {@link validateLoadout} before seating it, and the
 * lobby builds its choices from the same predicates, so a legal client
 * never sends something the relay refuses. Pure (reads static ship data).
 */

import { getShipDefinition } from "../../data/ShipDefinitions";
import type { ShipDefinition } from "../../core/types";
import { ALL_FACTIONS } from "../../ui/lobby/lobbyData";
import { MODE_RULES, type Loadout, type MatchMode } from "../protocol";

/**
 * @param definition - A ship definition.
 * @returns Whether a pilot may fly it online (no capital / huge ships).
 */
export function isOnlineShip(definition: ShipDefinition): boolean {
  return definition.role !== "capital" && definition.baseStats.size !== "huge";
}

/**
 * @param shipIds - Ship definition ids.
 * @returns Their combined hull points (unknown ids count as Infinity).
 */
export function squadPoints(shipIds: readonly string[]): number {
  return shipIds.reduce(
    (sum, id) => sum + (getShipDefinition(id)?.baseStats.pointCost ?? Infinity),
    0,
  );
}

/**
 * @param shipIds - A squad's ships in order.
 * @param pointLimit - Point limit.
 * @returns The longest prefix that fits the limit.
 */
export function fitToPointLimit(
  shipIds: readonly string[],
  pointLimit: number,
): string[] {
  const fitted: string[] = [];
  let points = 0;
  for (const id of shipIds) {
    points += getShipDefinition(id)?.baseStats.pointCost ?? Infinity;
    if (points > pointLimit) break;
    fitted.push(id);
  }
  return fitted;
}

/**
 * @param mode - The room's mode.
 * @param loadout - A shape-valid loadout from a client.
 * @returns Why the squad may not fly this mode, or null when it is legal.
 */
export function validateLoadout(
  mode: MatchMode,
  loadout: Loadout,
): string | null {
  const rules = MODE_RULES[mode];
  if (!ALL_FACTIONS.some((faction) => faction === loadout.faction))
    return `Unknown faction '${loadout.faction}'.`;
  if (loadout.ships.length < rules.minShips)
    return `Bring at least ${rules.minShips} ship(s).`;
  if (loadout.ships.length > rules.maxShips)
    return `This mode allows at most ${rules.maxShips} ship(s) per pilot.`;
  for (const id of loadout.ships) {
    const definition = getShipDefinition(id);
    if (!definition) return `Unknown ship '${id}'.`;
    if (definition.faction !== loadout.faction)
      return `${definition.name} does not fly for that faction.`;
    if (!isOnlineShip(definition))
      return `${definition.name} cannot fly online matches.`;
  }
  const points = squadPoints(loadout.ships);
  if (points > rules.pointLimit)
    return `Squad costs ${points} points; the limit is ${rules.pointLimit}.`;
  return null;
}
