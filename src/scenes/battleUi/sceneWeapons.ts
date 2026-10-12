/**
 * sceneWeapons — the few lines every battle scene shares to plug into the
 * secondary-weapons runtime: its BattleWeapons (with InputManager, the
 * battlefield size and the scene's tempo ledger), how one of its ship
 * records looks to the weapons, and its weapon bar (primary + secondaries).
 */

import type Phaser from "phaser";
import { BATTLEFIELD_SIZE } from "../../config";
import type { HitImmunityLedger } from "../../arcade/systems/CombatTempo";
import { InputManager } from "../../input/InputManager";
import type {
  BattleHudSnapshot,
  WeaponSlotDescriptor,
} from "../../ui/hud/types";
import { random } from "../../utils/random";
import { BattleWeapons, type BattleWeaponsLink } from "./BattleWeapons";

export {
  weaponBodyOf,
  type WeaponShipRecord,
} from "../../arcade/weapons/weaponBodies";

/**
 * The battle's secondary weapons, listening to the human's weapon keys.
 *
 * @param scene - The battle scene.
 * @param link - What the glue reads from the scene.
 * @param ledger - The scene's round-tempo ledger.
 * @returns The attached BattleWeapons (destroy it on shutdown).
 */
export function createSceneWeapons(
  scene: Phaser.Scene,
  link: BattleWeaponsLink,
  ledger: HitImmunityLedger,
): BattleWeapons {
  const weapons = new BattleWeapons(scene, link, {
    worldSize: BATTLEFIELD_SIZE,
    ledger,
    random: () => random.next(),
    input: InputManager,
  });
  weapons.attach();
  return weapons;
}

/**
 * A BattleHud snapshot whose weapon bar also shows the secondaries.
 *
 * @param snapshot - The scene's snapshot (primary slot first).
 * @param secondaries - Secondary and turret slots (BattleWeapons.hudSlots).
 * @returns The snapshot with the full weapon bar.
 */
export function withSecondaryWeapons<S extends BattleHudSnapshot>(
  snapshot: S,
  secondaries: readonly WeaponSlotDescriptor[],
): S {
  const [primary] = snapshot.weapons;
  if (!primary) return snapshot;
  return { ...snapshot, weapons: weaponBarSlots(primary, secondaries) };
}

/**
 * The weapon bar: the always-on primary, then the secondaries. With
 * secondaries the selection marker shows what FIRE_SECONDARY fires.
 *
 * @param primary - The primary laser slot.
 * @param secondaries - Secondary and turret slots (BattleWeapons.hudSlots).
 * @returns Slots, left to right.
 */
export function weaponBarSlots(
  primary: WeaponSlotDescriptor,
  secondaries: readonly WeaponSlotDescriptor[],
): WeaponSlotDescriptor[] {
  if (secondaries.length === 0) return [primary];
  const anySelected = secondaries.some((slot) => slot.selected);
  return [{ ...primary, selected: !anySelected }, ...secondaries];
}
