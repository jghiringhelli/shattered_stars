/**
 * Upgrade catalog — hull modifications, configurations and titles.
 *
 * Point values follow the catalog's fixed price rule (see
 * docs/specs/upgrades-and-slots.md): +1 hull = 3, +1 shield = 4, a 40%
 * faster recharge on one maneuver = 3, a trade-off configuration = 2.
 */

import type { UpgradeDefinition } from "../../core/upgradeTypes";

export const MODIFICATION_UPGRADES: Readonly<
  Record<string, UpgradeDefinition>
> = {
  hull_upgrade: {
    id: "hull_upgrade",
    name: "Hull Upgrade",
    slotType: "modification",
    description: "+1 hull.",
    pointCost: 3,
    creditCost: 150,
    effects: { hullBonus: 1 },
  },
  shield_upgrade: {
    id: "shield_upgrade",
    name: "Shield Upgrade",
    slotType: "modification",
    description: "+1 shield.",
    pointCost: 4,
    creditCost: 200,
    effects: { shieldBonus: 1 },
  },
  engine_upgrade: {
    id: "engine_upgrade",
    name: "Engine Upgrade",
    slotType: "modification",
    description: "Boost recharges 40% faster.",
    pointCost: 3,
    creditCost: 150,
    requiredShipSize: ["tiny", "small"],
    effects: { addsAction: "boost" },
    realtime: { boostCooldownMultiplier: 0.6 },
  },
  vectored_thrusters: {
    id: "vectored_thrusters",
    name: "Vectored Thrusters",
    slotType: "modification",
    description: "Barrel roll recharges 40% faster.",
    pointCost: 3,
    creditCost: 150,
    requiredShipSize: ["tiny", "small"],
    effects: { addsAction: "barrel_roll" },
    realtime: { barrelRollCooldownMultiplier: 0.6 },
  },
  stealth_device: {
    id: "stealth_device",
    name: "Stealth Device",
    slotType: "modification",
    description: "Takes 15% less damage from every hit.",
    pointCost: 6,
    creditCost: 300,
    requiredShipSize: ["tiny", "small"],
    effects: { agilityBonus: 1 },
    realtime: { damageTakenMultiplier: 0.85 },
  },
  combat_configuration: {
    id: "combat_configuration",
    name: "Combat Configuration",
    slotType: "configuration",
    description: "+1 laser damage, but takes 15% more damage.",
    pointCost: 2,
    creditCost: 100,
    effects: { attackBonus: 1, agilityBonus: -1 },
    realtime: { laserDamageBonus: 1, damageTakenMultiplier: 1.15 },
  },
  evasion_configuration: {
    id: "evasion_configuration",
    name: "Evasion Configuration",
    slotType: "configuration",
    description:
      "Takes 10% less damage, but maneuver stress builds 15% faster.",
    pointCost: 2,
    creditCost: 100,
    effects: { agilityBonus: 1 },
    realtime: { damageTakenMultiplier: 0.9, stressRateMultiplier: 1.15 },
  },
  ace_pilot_title: {
    id: "ace_pilot_title",
    name: "Ace Pilot",
    slotType: "title",
    description: "K-turns and barrel rolls recharge 20% faster.",
    pointCost: 3,
    creditCost: 200,
    isUnique: true,
    effects: { rerollCount: 1 },
    realtime: {
      kturnCooldownMultiplier: 0.8,
      barrelRollCooldownMultiplier: 0.8,
    },
  },
};
