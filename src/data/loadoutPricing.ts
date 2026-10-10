/**
 * loadoutPricing — the single rule that prices every ship build.
 *
 * A loadout costs the bare ship, plus the surcharge of the pilot flying it
 * (src/data/pilotPricing.ts), plus every upgrade bolted onto it. Nothing else. Prices used to be hand-authored literals per loadout, which drifted:
 * 196 of 215 disagreed with their own contents and 20 undercut the very ship
 * they upgrade, so "buy an upgrade" could read as a discount.
 *
 * Deriving the number instead of authoring it makes the catalogue consistent
 * and incremental by construction — an upgrade can only ever add points.
 *
 * Pure: reads the ship and upgrade catalogues, owns no state.
 */

import { SHIP_DEFINITIONS } from "./ShipDefinitions";
import { UPGRADE_DEFINITIONS } from "../systems/UpgradeSystem";
import { PILOT_CARDS } from "../systems/SquadBuilder";

/** Thrown when a loadout equips an upgrade that has no definition. */
export class UnknownUpgradeError extends Error {
  constructor(public readonly upgradeId: string) {
    super(
      `Unknown upgrade "${upgradeId}" — it has no entry in UPGRADE_DEFINITIONS, so it cannot be priced.`,
    );
    this.name = "UnknownUpgradeError";
  }
}

/** Thrown when a loadout is attached to a ship that has no definition. */
export class UnknownShipError extends Error {
  constructor(public readonly shipId: string) {
    super(
      `Unknown ship "${shipId}" — it has no entry in SHIP_DEFINITIONS, so its loadouts cannot be priced.`,
    );
    this.name = "UnknownShipError";
  }
}

/**
 * Point cost of a single upgrade.
 *
 * @param upgradeId - Key into UPGRADE_DEFINITIONS.
 * @returns The upgrade's point cost.
 * @throws UnknownUpgradeError if the upgrade has no definition. Silently
 *   pricing a typo at zero is how sub-base-cost loadouts got shipped.
 */
export function upgradeCost(upgradeId: string): number {
  const definition = UPGRADE_DEFINITIONS[upgradeId];
  if (!definition) throw new UnknownUpgradeError(upgradeId);
  return definition.pointCost;
}

/** Thrown when a loadout's pilot is unknown or flies a different ship. */
export class PilotShipMismatchError extends Error {
  constructor(
    public readonly pilotId: string,
    public readonly shipId: string,
  ) {
    super(
      `Pilot "${pilotId}" cannot fly "${shipId}" — the pilot card is missing or belongs to another ship.`,
    );
    this.name = "PilotShipMismatchError";
  }
}

/**
 * Surcharge of the pilot flying a loadout (0 for the rookie / no pilot).
 *
 * @param shipId - The ship the loadout is built on.
 * @param pilotId - Key into PILOT_CARDS, or undefined for a rookie.
 * @returns The pilot's surcharge.
 * @throws PilotShipMismatchError if the pilot is unknown or flies another ship.
 */
function pilotCost(shipId: string, pilotId: string | undefined): number {
  if (!pilotId) return 0;
  const pilot = PILOT_CARDS[pilotId];
  if (!pilot || pilot.shipId !== shipId) {
    throw new PilotShipMismatchError(pilotId, shipId);
  }
  return pilot.pointCost;
}

/**
 * Point cost of a ship flown by a pilot with a given set of upgrades.
 *
 * @param shipId - Key into SHIP_DEFINITIONS.
 * @param upgrades - Upgrade ids equipped. An upgrade listed twice is charged twice.
 * @param pilotId - Key into PILOT_CARDS; omitted means a free rookie.
 * @returns Bare ship cost plus the pilot surcharge plus every upgrade.
 * @throws UnknownShipError | UnknownUpgradeError | PilotShipMismatchError
 *   if anything cannot be priced.
 */
export function deriveLoadoutCost(
  shipId: string,
  upgrades: readonly string[],
  pilotId?: string,
): number {
  const ship = SHIP_DEFINITIONS[shipId];
  if (!ship) throw new UnknownShipError(shipId);
  return upgrades.reduce(
    (total, id) => total + upgradeCost(id),
    ship.baseStats.pointCost + pilotCost(shipId, pilotId),
  );
}
