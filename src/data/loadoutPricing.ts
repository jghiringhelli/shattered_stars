/**
 * loadoutPricing — the single rule that prices every ship build.
 *
 * A loadout costs the bare ship plus every upgrade bolted onto it. Nothing
 * else. Prices used to be hand-authored literals per loadout, which drifted:
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

/**
 * Point cost of a ship flying a given set of upgrades.
 *
 * @param shipId - Key into SHIP_DEFINITIONS.
 * @param upgrades - Upgrade ids equipped. An upgrade listed twice is charged twice.
 * @returns Bare ship cost plus the cost of every upgrade.
 * @throws UnknownShipError | UnknownUpgradeError if anything cannot be priced.
 */
export function deriveLoadoutCost(
  shipId: string,
  upgrades: readonly string[],
): number {
  const ship = SHIP_DEFINITIONS[shipId];
  if (!ship) throw new UnknownShipError(shipId);
  return upgrades.reduce(
    (total, id) => total + upgradeCost(id),
    ship.baseStats.pointCost,
  );
}
