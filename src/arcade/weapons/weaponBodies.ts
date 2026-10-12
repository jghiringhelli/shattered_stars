/**
 * weaponBodies — how a battle's ship record looks to the secondary-weapons
 * runtime, shared by the battle scenes and the headless sims.
 *
 * Pure: no Phaser.
 */

import { armorReductionOf } from "../systems/DamageRules";
import type { WeaponBody } from "./weaponTypes";

/** What a ship record must carry to be seen by the weapons. */
export interface WeaponShipRecord {
  readonly id: string;
  readonly definitionId: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly hull: number;
  readonly combatStats: { readonly agilityDice: number };
}

/**
 * @param ship - A battle's ship record.
 * @param side - Its side key.
 * @param damageTaken - Its incoming-damage multiplier (DamageRules).
 * @returns The ship as the weapons see it.
 */
export function weaponBodyOf(
  ship: WeaponShipRecord,
  side: string,
  damageTaken: number,
): WeaponBody {
  return {
    id: ship.id,
    side,
    x: ship.x,
    y: ship.y,
    angle: ship.angle,
    hull: ship.hull,
    agilityDice: ship.combatStats.agilityDice,
    damageTaken,
    armor: armorReductionOf(ship.definitionId),
  };
}
