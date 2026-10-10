/**
 * Upgrade catalog — weapons: forward cannons, turrets, missiles, torpedoes
 * and bombs.
 *
 * Cannons modify the ship's forward laser (realtime modifiers). Every other
 * weapon carries a {@link WeaponProfile}: the arcade ordnance and turret
 * systems read damage, reload, range and homing straight from these cards, so
 * the price on the card and the behaviour in battle come from one place.
 */

import type { UpgradeDefinition } from "../../core/upgradeTypes";

export const CANNON_UPGRADES: Readonly<Record<string, UpgradeDefinition>> = {
  heavy_laser_cannon: {
    id: "heavy_laser_cannon",
    name: "Heavy Laser Cannon",
    slotType: "cannon",
    description: "+1 damage on every forward-laser bolt.",
    pointCost: 5,
    creditCost: 250,
    effects: { attackBonus: 1 },
    realtime: { laserDamageBonus: 1 },
  },
  ion_cannon: {
    id: "ion_cannon",
    name: "Ion Cannon",
    slotType: "cannon",
    description:
      "Forward-laser hits overload the target's pilot (+12% stress).",
    pointCost: 4,
    creditCost: 200,
    realtime: { stressOnHit: 0.12 },
  },
  jamming_beam: {
    id: "jamming_beam",
    name: "Jamming Beam",
    slotType: "cannon",
    description: "Forward-laser hits rattle the target's pilot (+6% stress).",
    pointCost: 2,
    creditCost: 100,
    realtime: { stressOnHit: 0.06 },
  },
};

export const TURRET_UPGRADES: Readonly<Record<string, UpgradeDefinition>> = {
  light_laser_turret: {
    id: "light_laser_turret",
    name: "Light Laser Turret",
    slotType: "turret",
    description: "360° auto-turret: 1 damage every 1.5s, short range.",
    pointCost: 2,
    creditCost: 100,
    weapon: { damage: 1, cooldownMs: 1500, rangePx: 350 },
  },
  twin_laser_turret: {
    id: "twin_laser_turret",
    name: "Twin Laser Turret",
    slotType: "turret",
    description: "360° auto-turret: 2 damage every 2s, long range.",
    pointCost: 4,
    creditCost: 200,
    weapon: { damage: 2, cooldownMs: 2000, rangePx: 400 },
  },
  ion_turret: {
    id: "ion_turret",
    name: "Ion Cannon Turret",
    slotType: "turret",
    description:
      "360° auto-turret: 1 damage every 2s, each hit adds 20% stress.",
    pointCost: 4,
    creditCost: 200,
    weapon: { damage: 1, cooldownMs: 2000, rangePx: 320, stressOnHit: 0.2 },
  },
  quad_laser_turret: {
    id: "quad_laser_turret",
    name: "Quad Laser Cannon",
    slotType: "turret",
    description: "360° auto-turret: 3 damage every 2s.",
    pointCost: 6,
    creditCost: 300,
    requiredShipSize: ["medium", "large", "huge"],
    weapon: { damage: 3, cooldownMs: 2000, rangePx: 350 },
  },
};

export const ORDNANCE_UPGRADES: Readonly<Record<string, UpgradeDefinition>> = {
  concussion_missile: {
    id: "concussion_missile",
    name: "Concussion Missiles",
    slotType: "missile",
    description: "3 homing missiles: 3 damage each, 4s reload.",
    pointCost: 4,
    creditCost: 200,
    effects: { chargesAdded: 3 },
    weapon: {
      damage: 3,
      cooldownMs: 4000,
      homingTurnRate: 90,
      homingTurnBudget: 360,
    },
  },
  seeker_missile: {
    id: "seeker_missile",
    name: "Seeker Missiles",
    slotType: "missile",
    description:
      "2 agile homing missiles: 2 damage each, hard to shake, 3s reload.",
    pointCost: 3,
    creditCost: 150,
    effects: { chargesAdded: 2 },
    weapon: {
      damage: 2,
      cooldownMs: 3000,
      homingTurnRate: 140,
      homingTurnBudget: 540,
    },
  },
  proton_torpedo: {
    id: "proton_torpedo",
    name: "Proton Torpedoes",
    slotType: "torpedo",
    description: "2 slow-tracking torpedoes: 5 damage each, 6s reload.",
    pointCost: 5,
    creditCost: 250,
    effects: { chargesAdded: 2 },
    weapon: {
      damage: 5,
      cooldownMs: 6000,
      homingTurnRate: 50,
      homingTurnBudget: 240,
    },
  },
  ion_torpedo: {
    id: "ion_torpedo",
    name: "Ion Torpedoes",
    slotType: "torpedo",
    description: "2 torpedoes: 3 damage and +45% stress per hit, 6s reload.",
    pointCost: 5,
    creditCost: 250,
    effects: { chargesAdded: 2 },
    weapon: {
      damage: 3,
      cooldownMs: 6000,
      homingTurnRate: 50,
      homingTurnBudget: 240,
      stressOnHit: 0.45,
    },
  },
  proton_bomb: {
    id: "proton_bomb",
    name: "Proton Bombs",
    slotType: "bomb",
    description: "2 bombs dropped astern: 5 damage each, 8s reload.",
    pointCost: 5,
    creditCost: 250,
    effects: { chargesAdded: 2 },
    weapon: { damage: 5, cooldownMs: 8000 },
  },
  cluster_mine: {
    id: "cluster_mine",
    name: "Cluster Mines",
    slotType: "bomb",
    description: "3 mines dropped astern: 3 damage each, 4s reload.",
    pointCost: 4,
    creditCost: 200,
    effects: { chargesAdded: 3 },
    weapon: { damage: 3, cooldownMs: 4000 },
  },
  proximity_mine: {
    id: "proximity_mine",
    name: "Proximity Mines",
    slotType: "bomb",
    description: "2 mines dropped astern: 3 damage each, 8s reload.",
    pointCost: 3,
    creditCost: 150,
    effects: { chargesAdded: 2 },
    weapon: { damage: 3, cooldownMs: 8000 },
  },
  seismic_charge: {
    id: "seismic_charge",
    name: "Seismic Charges",
    slotType: "bomb",
    description:
      "2 charges dropped astern: 3 damage and +25% stress, 8s reload.",
    // Mirrors OrdnanceSystem's `seismic_charges` entry (4pt, 2 charges).
    pointCost: 4,
    creditCost: 200,
    effects: { chargesAdded: 2 },
    weapon: { damage: 3, cooldownMs: 8000, stressOnHit: 0.25 },
  },
};
