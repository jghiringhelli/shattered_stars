/**
 * Upgrade catalog — psionic disciplines (the `force_power` slot that Ascendant
 * pilot cards add). Each power is a steady real-time effect: tabletop's
 * "spend 1 psi" cards fire on their own on a recharge, read as a rate
 * or a permanent edge (docs/specs/upgrades-and-slots.md §4). Two act on
 * allies inside the pilot's aura, two on the pilot.
 */

import type { UpgradeDefinition } from "../../core/upgradeTypes";

export const FORCE_POWER_UPGRADES: Readonly<Record<string, UpgradeDefinition>> =
  {
    battle_meditation: {
      id: "battle_meditation",
      name: "War Chorus",
      slotType: "force_power",
      description:
        "Projects the faction aura; allies inside it shoot 5% more accurately.",
      pointCost: 2,
      creditCost: 300,
      requiredFaction: "ascendant_empire",
      realtime: { projectsAura: true, auraHitChanceBonus: 0.05 },
    },
    mending_light: {
      id: "mending_light",
      name: "Mending Light",
      slotType: "force_power",
      description:
        "Projects the faction aura; allies inside it regenerate 1 shield every ~200 seconds.",
      pointCost: 2,
      creditCost: 300,
      requiredFaction: "ascendant_empire",
      realtime: { projectsAura: true, auraShieldRegenPerSecond: 0.06 },
    },
    foresight: {
      id: "foresight",
      name: "Foresight",
      slotType: "force_power",
      description:
        "Sees the shot coming: takes 10% less damage from every hit.",
      pointCost: 2,
      creditCost: 200,
      requiredFaction: "ascendant_empire",
      realtime: { damageTakenMultiplier: 0.9 },
    },
    righteous_wrath: {
      id: "righteous_wrath",
      name: "Righteous Wrath",
      slotType: "force_power",
      description: "+1 laser damage once the pilot's hull has taken damage.",
      pointCost: 3,
      creditCost: 150,
      requiredFaction: "ascendant_empire",
      realtime: { damagedLaserBonus: 1 },
    },
  };
