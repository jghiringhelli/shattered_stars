/**
 * research — the campaign Research tree (SC2 Wings of Liberty research):
 * tiers unlock as research points are earned (bonus objectives grant them);
 * each tier is a permanent, mutually exclusive choice between two options
 * for that playthrough. Research cannot be respecced.
 */

import type { CampaignShipBonuses } from "../../campaign/armory/bonusTypes";

/** One side of a research tier. */
export interface ResearchOption {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly bonuses: Partial<CampaignShipBonuses>;
}

/** A binary research choice. */
export interface ResearchTier {
  readonly id: string;
  readonly name: string;
  /** Research points that must have been earned to unlock it. */
  readonly requiredPoints: number;
  readonly optionA: ResearchOption;
  readonly optionB: ResearchOption;
}

/** Which option a tier was resolved to. */
export type ResearchPick = "A" | "B";

/** The research tree, in unlock order. */
export const RESEARCH_TREE: readonly ResearchTier[] = [
  {
    id: "hull_doctrine",
    name: "Hull Doctrine",
    requiredPoints: 2,
    optionA: {
      id: "reactive_plating",
      name: "Reactive Plating",
      description: "+15% hull for the squad.",
      bonuses: { hullMultiplier: 1.15 },
    },
    optionB: {
      id: "shield_harmonics",
      name: "Shield Harmonics",
      description: "+20% shields and +0.12 shield HP/s regeneration.",
      bonuses: { shieldMultiplier: 1.2, shieldRegenPerSecond: 0.12 },
    },
  },
  {
    id: "command_doctrine",
    name: "Command Doctrine",
    requiredPoints: 6,
    optionA: {
      id: "hero_conduit",
      name: "Hero Conduit",
      description: "Hero powers recharge 20% faster.",
      bonuses: { powerCooldownMultiplier: 0.8 },
    },
    optionB: {
      id: "wing_doctrine",
      name: "Wing Doctrine",
      description: "+1 damage for your wingmen.",
      bonuses: { escortAttackBonus: 1 },
    },
  },
  {
    id: "logistics",
    name: "Logistics",
    requiredPoints: 11,
    optionA: {
      id: "salvage_protocols",
      name: "Salvage Protocols",
      description: "+25% credits from every mission.",
      bonuses: { creditMultiplier: 1.25 },
    },
    optionB: {
      id: "tactical_analysis",
      name: "Tactical Analysis",
      description: "+1 research point for every bonus objective.",
      bonuses: { researchPerBonus: 1 },
    },
  },
  {
    id: "weapons_doctrine",
    name: "Weapons Doctrine",
    requiredPoints: 17,
    optionA: {
      id: "heavy_lances",
      name: "Heavy Lances",
      description: "+1 damage on every primary hit.",
      bonuses: { attackBonus: 1 },
    },
    optionB: {
      id: "phase_cyclers",
      name: "Phase Cyclers",
      description: "Boost, barrel roll and Snap Turn recharge 20% faster.",
      bonuses: { maneuverRechargeMultiplier: 0.8 },
    },
  },
];
