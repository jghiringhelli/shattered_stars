/**
 * armory — campaign-only ship modifications bought with credits in the hub
 * Armory (SC2 Wings of Liberty armory). One mod per slot; installing pays
 * its cost, uninstalling (or a full respec) refunds what was paid, so
 * players can rebuild freely between missions. Applied to the whole player
 * squad. Not part of the global upgrade catalog.
 */

import type { CampaignShipBonuses } from "../../campaign/armory/bonusTypes";

/** Armory slots (one mod each). */
export type ArmorySlot = "hull" | "shields" | "weapons" | "systems";

/** One modification. */
export interface ArmoryMod {
  readonly id: string;
  readonly name: string;
  readonly slot: ArmorySlot;
  readonly cost: number;
  readonly description: string;
  readonly bonuses: Partial<CampaignShipBonuses>;
}

/** Display order of the slots. */
export const ARMORY_SLOTS: readonly ArmorySlot[] = [
  "hull",
  "shields",
  "weapons",
  "systems",
];

/** Every modification. */
export const ARMORY_MODS: readonly ArmoryMod[] = [
  {
    id: "reinforced_bulkheads",
    name: "Reinforced Bulkheads",
    slot: "hull",
    cost: 150,
    description: "+20% hull on every ship of your squad.",
    bonuses: { hullMultiplier: 1.2 },
  },
  {
    id: "ablative_armor",
    name: "Ablative Armor",
    slot: "hull",
    cost: 220,
    description: "Squad takes 12% less damage.",
    bonuses: { damageTakenMultiplier: 0.88 },
  },
  {
    id: "capacitor_array",
    name: "Capacitor Array",
    slot: "shields",
    cost: 150,
    description: "+25% shields on every ship of your squad.",
    bonuses: { shieldMultiplier: 1.25 },
  },
  {
    id: "regenerative_emitters",
    name: "Regenerative Emitters",
    slot: "shields",
    cost: 200,
    description: "Shields regenerate 1.5 HP/s in combat.",
    bonuses: { shieldRegenPerSecond: 1.5 },
  },
  {
    id: "overcharged_cannons",
    name: "Overcharged Cannons",
    slot: "weapons",
    cost: 260,
    description: "+1 damage on every primary hit.",
    bonuses: { attackBonus: 1 },
  },
  {
    id: "rapid_cyclers",
    name: "Rapid Cyclers",
    slot: "weapons",
    cost: 220,
    description: "Primary weapons recycle 15% faster.",
    bonuses: { weaponIntervalMultiplier: 0.85 },
  },
  {
    id: "combat_computer",
    name: "Combat Computer",
    slot: "systems",
    cost: 180,
    description: "+0.5 evasion for every ship of your squad.",
    bonuses: { agilityBonus: 0.5 },
  },
  {
    id: "hero_capacitors",
    name: "Hero Capacitors",
    slot: "systems",
    cost: 240,
    description: "Hero powers recharge 15% faster.",
    bonuses: { powerCooldownMultiplier: 0.85 },
  },
];

/**
 * @param id - Mod id.
 * @returns The mod, if it exists.
 */
export function getArmoryMod(id: string): ArmoryMod | undefined {
  return ARMORY_MODS.find((mod) => mod.id === id);
}
