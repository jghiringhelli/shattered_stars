/**
 * Upgrade catalog — ship systems and the people/droids who run them:
 * sensors, tech, crew, gunners and astromechs.
 */

import type { UpgradeDefinition } from "../../core/upgradeTypes";

export const SENSOR_AND_TECH_UPGRADES: Readonly<
  Record<string, UpgradeDefinition>
> = {
  fire_control_system: {
    id: "fire_control_system",
    name: "Fire-Control System",
    slotType: "sensor",
    description: "Ordnance reloads 15% faster.",
    pointCost: 1,
    creditCost: 100,
    realtime: { ordnanceCooldownMultiplier: 0.85 },
  },
  advanced_sensors: {
    id: "advanced_sensors",
    name: "Advanced Sensors",
    slotType: "sensor",
    description: "K-turn, Segnor loop and Tallon roll recharge 30% faster.",
    pointCost: 2,
    creditCost: 150,
    realtime: { kturnCooldownMultiplier: 0.7 },
  },
  collision_detector: {
    id: "collision_detector",
    name: "Collision Detector",
    slotType: "sensor",
    description:
      "Safe close passes: +1 laser damage at range 1; boost and barrel roll recharge 20% faster.",
    pointCost: 3,
    creditCost: 200,
    realtime: {
      closeRangeLaserBonus: 1,
      boostCooldownMultiplier: 0.8,
      barrelRollCooldownMultiplier: 0.8,
    },
  },
  targeting_computer: {
    id: "targeting_computer",
    name: "Targeting Computer",
    slotType: "tech",
    description: "Homing ordnance tracks 120° longer before flying straight.",
    pointCost: 1,
    creditCost: 100,
    effects: { addsAction: "calculate" },
    realtime: { homingTurnBonus: 120 },
  },
  pattern_analyzer: {
    id: "pattern_analyzer",
    name: "Pattern Analyzer",
    slotType: "tech",
    description:
      "Reads the target's next move: +1 laser damage in the bullseye; maneuver stress builds 20% slower.",
    pointCost: 1,
    creditCost: 150,
    realtime: { bullseyeLaserBonus: 1, stressRateMultiplier: 0.8 },
  },
};

export const CREW_UPGRADES: Readonly<Record<string, UpgradeDefinition>> = {
  veteran_gunner: {
    id: "veteran_gunner",
    name: "Veteran Gunner",
    slotType: "crew",
    description: "Turret fires 30% faster.",
    pointCost: 2,
    creditCost: 250,
    requiredShipSize: ["medium", "large", "huge"],
    realtime: { turretCooldownMultiplier: 0.7 },
  },
  tactical_officer: {
    id: "tactical_officer",
    name: "Tactical Officer",
    slotType: "crew",
    description:
      "Projects the faction support aura to nearby allies (or widens it 25% on ships that already project one).",
    pointCost: 2,
    creditCost: 200,
    effects: { addsActionLinked: { action: "coordinate", linkedTo: "focus" } },
    realtime: { projectsAura: true, auraRadiusBonus: 0.25 },
  },
  weapons_engineer: {
    id: "weapons_engineer",
    name: "Weapons Engineer",
    slotType: "crew",
    description: "+1 charge on every ordnance slot.",
    pointCost: 2,
    creditCost: 150,
    requiredShipSize: ["medium", "large", "huge"],
    realtime: { ordnanceBonusCharges: 1 },
  },
  mechanic: {
    id: "mechanic",
    name: "Mechanic",
    slotType: "crew",
    description:
      "Patches 1 hull every ~12 seconds once the ship is out of fire.",
    pointCost: 5,
    creditCost: 200,
    realtime: { hullRepairPerSecond: 0.96 },
  },
  skilled_gunner: {
    id: "skilled_gunner",
    name: "Skilled Gunner",
    slotType: "gunner",
    description: "Turret fires 20% faster.",
    pointCost: 1,
    creditCost: 150,
    requiredShipSize: ["medium", "large", "huge"],
    realtime: { turretCooldownMultiplier: 0.8 },
  },
};

export const ASTROMECH_UPGRADES: Readonly<Record<string, UpgradeDefinition>> = {
  repair_astromech: {
    id: "repair_astromech",
    name: "Repair Astromech",
    slotType: "astromech",
    description: "Regenerates 1 shield every ~100 seconds.",
    pointCost: 1,
    creditCost: 200,
    realtime: { shieldRegenPerSecond: 0.12 },
  },
  patch_astromech: {
    id: "patch_astromech",
    name: "Patch Astromech",
    slotType: "astromech",
    description:
      "Welds 1 hull back every ~20 seconds once the ship is out of fire.",
    pointCost: 3,
    creditCost: 150,
    realtime: { hullRepairPerSecond: 0.6 },
  },
  targeting_astromech: {
    id: "targeting_astromech",
    name: "Targeting Astromech",
    slotType: "astromech",
    description: "Ordnance reloads 10% faster and tracks 60° longer.",
    pointCost: 1,
    creditCost: 150,
    requiredFaction: "free_confederation",
    realtime: { ordnanceCooldownMultiplier: 0.9, homingTurnBonus: 60 },
  },
  flight_astromech: {
    id: "flight_astromech",
    name: "Flight Astromech",
    slotType: "astromech",
    description: "Every maneuver counts one difficulty easier for stress.",
    pointCost: 2,
    creditCost: 200,
    realtime: { stressReliefTiers: 1 },
  },
};
