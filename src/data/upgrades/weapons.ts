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
    description: "360° auto-turret, range 1–2: 1 damage every 1.5s.",
    pointCost: 2,
    creditCost: 100,
    weapon: { damage: 1, cooldownMs: 1500, rangeBand: [1, 2] },
  },
  twin_laser_turret: {
    id: "twin_laser_turret",
    name: "Twin Laser Turret",
    slotType: "turret",
    description: "360° auto-turret, range 2–3: 2 damage every 2s.",
    pointCost: 4,
    creditCost: 200,
    weapon: { damage: 2, cooldownMs: 2000, rangeBand: [2, 3] },
  },
  ion_turret: {
    id: "ion_turret",
    name: "Ion Cannon Turret",
    slotType: "turret",
    description:
      "360° auto-turret, range 1–2: 1 damage every 2s, +20% stress per hit.",
    pointCost: 4,
    creditCost: 200,
    weapon: {
      damage: 1,
      cooldownMs: 2000,
      rangeBand: [1, 2],
      stressOnHit: 0.2,
    },
  },
  quad_laser_turret: {
    id: "quad_laser_turret",
    name: "Quad Laser Cannon",
    slotType: "turret",
    description: "360° auto-turret, range 1–3: 3 damage every 2s.",
    pointCost: 6,
    creditCost: 300,
    requiredShipSize: ["medium", "large", "huge"],
    weapon: { damage: 3, cooldownMs: 2000, rangeBand: [1, 3] },
  },
};

export const ORDNANCE_UPGRADES: Readonly<Record<string, UpgradeDefinition>> = {
  concussion_missile: {
    id: "concussion_missile",
    name: "Concussion Missiles",
    slotType: "missile",
    description:
      "3 homing missiles (lock, front arc, range 2–3): 30 damage each, 4s reload.",
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
      "2 agile homing missiles (lock, front arc, range 1–2): 20 damage each, 3s reload.",
    pointCost: 3,
    creditCost: 150,
    effects: { chargesAdded: 2 },
    weapon: {
      damage: 2,
      cooldownMs: 3000,
      homingTurnRate: 140,
      homingTurnBudget: 540,
      rangeBand: [1, 2],
    },
  },
  proton_torpedo: {
    id: "proton_torpedo",
    name: "Proton Torpedoes",
    slotType: "torpedo",
    description:
      "2 slow-tracking torpedoes (lock, front arc, range 2–3): 50 damage each, 6s reload.",
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
    description:
      "2 torpedoes (lock, front arc, range 2–3): 30 damage and +45% stress, 6s reload.",
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
    description:
      "2 bombs dropped astern: blast 1 s later hits every ship within range 1 for 50 damage, 8s reload.",
    pointCost: 5,
    creditCost: 250,
    effects: { chargesAdded: 2 },
    weapon: { damage: 5, cooldownMs: 8000, device: "bomb" },
  },
  cluster_mine: {
    id: "cluster_mine",
    name: "Cluster Mines",
    slotType: "bomb",
    description:
      "3 mines dropped astern: armed after a cycle, the first enemy to touch one sets off a 30-damage blast, 4s reload.",
    pointCost: 4,
    creditCost: 200,
    effects: { chargesAdded: 3 },
    weapon: { damage: 3, cooldownMs: 4000, device: "mine" },
  },
  proximity_mine: {
    id: "proximity_mine",
    name: "Proximity Mines",
    slotType: "bomb",
    description:
      "2 mines dropped astern: armed after a cycle, the first enemy to touch one sets off a 30-damage blast, 8s reload.",
    pointCost: 3,
    creditCost: 150,
    effects: { chargesAdded: 2 },
    weapon: { damage: 3, cooldownMs: 8000, device: "mine" },
  },
  seismic_charge: {
    id: "seismic_charge",
    name: "Seismic Charges",
    slotType: "bomb",
    description:
      "2 charges dropped astern: blast 1 s later hits every ship within range 1 for 30 damage and +25% stress, 8s reload.",
    // Mirrors OrdnanceSystem's `seismic_charges` entry (4pt, 2 charges).
    pointCost: 4,
    creditCost: 200,
    effects: { chargesAdded: 2 },
    weapon: {
      damage: 3,
      cooldownMs: 8000,
      stressOnHit: 0.25,
      device: "bomb",
    },
  },
};
