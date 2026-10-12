/**
 * quickBuildIndex — which offered quick builds fly a pilot or a card, and
 * the squad limit of the format a ship flies in.
 *
 * Battles fly quick builds only, so a pilot or card is playable exactly
 * when an offered build (one the pickers list: it carries at least one card,
 * see getEquippableLoadouts) flies it. Read by the reach invariant
 * (tests/unit/data/QuickBuildReach.test.ts) and the Encyclopedia ("fly it
 * in…"). Pure: reads the catalogues, owns no state.
 */

import { SQUAD_POINT_LIMITS } from "../systems/SquadBuilder";
import { SHIP_DEFINITIONS } from "./ShipDefinitions";
import { SHIP_LOADOUTS, type ShipLoadout } from "./ShipLoadouts";

/** Huge hulls fly only in the Epic format (Squad Builder gate). */
const EPIC_ONLY_SIZE = "huge";

/**
 * Every quick build the pickers offer (at least one card equipped).
 * @returns The offered builds of every ship, in catalogue order.
 */
export function offeredQuickBuilds(): ShipLoadout[] {
  return Object.values(SHIP_LOADOUTS)
    .flat()
    .filter((build) => build.upgrades.length > 0);
}

/**
 * @param pilotId - A PILOT_CARDS key.
 * @returns The offered builds this pilot flies.
 */
export function buildsFlyingPilot(pilotId: string): ShipLoadout[] {
  return offeredQuickBuilds().filter((build) => build.pilotId === pilotId);
}

/**
 * @param cardId - An upgrade card id.
 * @returns The offered builds that equip this card.
 */
export function buildsFlyingCard(cardId: string): ShipLoadout[] {
  return offeredQuickBuilds().filter((build) =>
    build.upgrades.includes(cardId),
  );
}

/**
 * The squad point limit of the format a ship flies in: huge hulls in Epic,
 * every other hull in a standard squad.
 * @param shipId - Ship definition id.
 * @returns The format's point limit.
 */
export function modeLimitFor(shipId: string): number {
  const size = SHIP_DEFINITIONS[shipId]?.baseStats.size;
  return size === EPIC_ONLY_SIZE
    ? SQUAD_POINT_LIMITS.epic
    : SQUAD_POINT_LIMITS.standard;
}
