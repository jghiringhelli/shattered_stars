/**
 * Upgrade catalog — pilot talents and illicit (black-market) gear.
 *
 * Talents are trained skills any pilot can slot; they are separate from the
 * single signature ability printed on each pilot card. Illicit gear gives a
 * strong effect paid for with a drawback, so it is cheap for its power.
 */

import type { UpgradeDefinition } from "../../core/upgradeTypes";

export const TALENT_UPGRADES: Readonly<Record<string, UpgradeDefinition>> = {
  predator: {
    id: "predator",
    name: "Predator",
    slotType: "talent",
    description: "+1 laser damage against targets whose shields are down.",
    pointCost: 3,
    creditCost: 150,
    effects: { rerollCount: 1 },
    realtime: { bonusDamageVsUnshielded: 1 },
  },
  elusive: {
    id: "elusive",
    name: "Elusive",
    slotType: "talent",
    description:
      "Takes 10% less damage, but maneuver stress builds 10% faster.",
    pointCost: 1,
    creditCost: 150,
    realtime: { damageTakenMultiplier: 0.9, stressRateMultiplier: 1.1 },
  },
  marksman: {
    id: "marksman",
    name: "Marksman",
    slotType: "talent",
    description: "+1 laser damage while the pilot is not stressed.",
    pointCost: 4,
    creditCost: 100,
    realtime: { calmLaserDamageBonus: 1 },
  },
  daredevil: {
    id: "daredevil",
    name: "Daredevil",
    slotType: "talent",
    description: "K-turn, Segnor loop and Tallon roll recharge 40% faster.",
    pointCost: 2,
    creditCost: 200,
    requiredShipSize: ["tiny", "small"],
    realtime: { kturnCooldownMultiplier: 0.6 },
  },
  expert_handling: {
    id: "expert_handling",
    name: "Expert Handling",
    slotType: "talent",
    description: "Barrel roll recharges 25% faster.",
    pointCost: 1,
    creditCost: 100,
    effects: { addsAction: "barrel_roll" },
    realtime: { barrelRollCooldownMultiplier: 0.75 },
  },
  phantom_strike: {
    id: "phantom_strike",
    name: "Phantom Strike",
    slotType: "talent",
    description:
      "+1 laser damage from behind the target; the cloak lasts 4 seconds longer.",
    pointCost: 2,
    creditCost: 200,
    realtime: { rearArcLaserBonus: 1, cloakDurationBonus: 4 },
  },
  force_sensitive: {
    id: "force_sensitive",
    name: "Force Sensitive",
    slotType: "talent",
    description: "Takes 15% less damage from every hit.",
    pointCost: 2,
    creditCost: 300,
    requiredFaction: "ascendant_empire",
    effects: { chargesAdded: 1 },
    realtime: { damageTakenMultiplier: 0.85 },
  },
  precognition: {
    id: "precognition",
    name: "Precognition",
    slotType: "talent",
    description: "Maneuver stress builds 25% slower.",
    pointCost: 1,
    creditCost: 200,
    requiredFaction: "ascendant_empire",
    realtime: { stressRateMultiplier: 0.75 },
  },
  coordinated_assault: {
    id: "coordinated_assault",
    name: "Coordinated Assault",
    slotType: "talent",
    description:
      "Projects the faction support aura to nearby allies (or widens it 25% on ships that already project one).",
    pointCost: 2,
    creditCost: 200,
    realtime: { projectsAura: true, auraRadiusBonus: 0.25 },
  },
  squadron_leader: {
    id: "squadron_leader",
    name: "Squadron Leader",
    slotType: "talent",
    description: "Every maneuver counts one difficulty easier for stress.",
    pointCost: 2,
    creditCost: 200,
    realtime: { stressReliefTiers: 1 },
  },
  bombardier: {
    id: "bombardier",
    name: "Bombardier",
    slotType: "talent",
    description: "Ordnance reloads 20% faster.",
    pointCost: 1,
    creditCost: 150,
    requiredShipRole: "bomber",
    realtime: { ordnanceCooldownMultiplier: 0.8 },
  },
};

export const ILLICIT_UPGRADES: Readonly<Record<string, UpgradeDefinition>> = {
  overcharged_capacitors: {
    id: "overcharged_capacitors",
    name: "Overcharged Capacitors",
    slotType: "illicit",
    description: "+1 laser damage, but maneuver stress builds 25% faster.",
    pointCost: 4,
    creditCost: 150,
    realtime: { laserDamageBonus: 1, stressRateMultiplier: 1.25 },
  },
  hot_wired_engines: {
    id: "hot_wired_engines",
    name: "Hot-Wired Engines",
    slotType: "illicit",
    description:
      "Boost recharges 50% faster, but maneuver stress builds 20% faster.",
    pointCost: 1,
    creditCost: 100,
    realtime: { boostCooldownMultiplier: 0.5, stressRateMultiplier: 1.2 },
  },
  black_market_munitions: {
    id: "black_market_munitions",
    name: "Black-Market Munitions",
    slotType: "illicit",
    description:
      "+1 charge on every ordnance slot, but the volatile cargo makes the ship take 10% more damage.",
    pointCost: 1,
    creditCost: 100,
    realtime: { ordnanceBonusCharges: 1, damageTakenMultiplier: 1.1 },
  },
  jury_rigged_deflectors: {
    id: "jury_rigged_deflectors",
    name: "Jury-Rigged Deflectors",
    slotType: "illicit",
    description:
      "Regenerates 1 shield every ~200 seconds, but nursing the scrap deflectors builds stress 20% faster.",
    pointCost: 1,
    creditCost: 50,
    // Was -1 hull + 0.18 HP/s: a trap on every hull (squad mirrors, 600
    // battles: -6 pts on a 4-hull Venom, -9 on a 2-hull Fang, which it left
    // at 1 hull). Without the hull loss it is safe on 2-hull light
    // fighters: -0.1 (Fang) / 0 (Venom) pts — a 1-pt illicit filler.
    realtime: { shieldRegenPerSecond: 0.06, stressRateMultiplier: 1.2 },
  },
};
