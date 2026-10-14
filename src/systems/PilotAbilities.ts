/**
 * Pilot Abilities System
 *
 * Individual pilot skills, talents, and upgrades that can be
 * earned through campaign progression or purchased in squad building.
 */

import type { ShipState, ActionType } from "../core/types";
import type { FactionId } from "../config";
import { angleToTarget, isInArc } from "./MovementSystem";

// ============================================
// Ability Categories
// ============================================

export type AbilityCategory =
  | "offensive" // Attack bonuses
  | "defensive" // Defense bonuses
  | "movement" // Maneuver benefits
  | "support" // Team buffs
  | "special"; // Unique mechanics

export type AbilityTrigger =
  | "passive" // Always active
  | "on_attack" // When attacking
  | "on_defend" // When defending
  | "on_maneuver" // After executing maneuver
  | "on_action" // When performing action
  | "on_damage" // When taking damage
  | "on_kill" // When destroying an enemy
  | "start_of_round" // Beginning of each round
  | "end_of_round" // End of each round
  | "activated"; // Must be manually activated (uses action)

// ============================================
// Ability Definition
// ============================================

export interface PilotAbility {
  readonly id: string;
  readonly name: string;
  readonly category: AbilityCategory;
  readonly trigger: AbilityTrigger;
  readonly description: string;

  // Requirements
  readonly minPilotSkill?: number;
  readonly requiredFaction?: FactionId;
  readonly requiredShipRole?: string;
  readonly incompatibleWith?: string[]; // Other abilities that can't be combined

  // Costs
  readonly pointCost: number;
  readonly xpCost: number; // For campaign unlock

  // Effects (values used by the combat/movement systems)
  readonly effects: AbilityEffects;
}

export interface AbilityEffects {
  // Attack modifiers
  readonly attackDiceBonus?: number;
  readonly rerollAttackDice?: number;
  readonly convertFocusToHit?: number;
  readonly convertBlankToFocus?: number;
  readonly bonusDamageOnCrit?: number;

  // Defense modifiers
  readonly defenseDiceBonus?: number;
  readonly rerollDefenseDice?: number;
  readonly convertFocusToEvade?: number;
  readonly damageReduction?: number;
  readonly shieldRegen?: number;

  // Movement modifiers
  readonly speedBonus?: number;
  readonly freeBoostAfterManeuver?: boolean;
  readonly freeBarrelRollAfterManeuver?: boolean;
  readonly reduceManeuverDifficulty?: boolean;
  readonly ignoreBumpDamage?: boolean;

  // Action modifiers
  readonly freeActionOnActivate?: ActionType;
  readonly doubleTokens?: ActionType; // Get 2 tokens instead of 1
  readonly linkAction?: { from: ActionType; to: ActionType };

  // Special
  readonly stressImmunity?: boolean;
  readonly ionImmunity?: boolean;
  readonly tractorImmunity?: boolean;
  readonly cloakPersists?: boolean;
  readonly extraAttack?: boolean;
  readonly rangeBonus?: number;

  // Conditional
  readonly condition?: AbilityCondition;
}

export type AbilityCondition =
  | { type: "range"; value: 1 | 2 | 3 }
  | { type: "bullseye" }
  | { type: "behind_target" }
  | { type: "stressed" }
  | { type: "damaged"; threshold: number }
  | { type: "outnumbered" }
  | { type: "near_ally"; distance: number };

// ============================================
// Pilot Ability Definitions
// ============================================

export const PILOT_ABILITIES: Record<string, PilotAbility> = {
  // ============================================
  // OFFENSIVE ABILITIES
  // ============================================
  marksmanship: {
    id: "marksmanship",
    name: "Marksmanship",
    category: "offensive",
    trigger: "on_attack",
    description: "When attacking, you may convert 1 focus to a critical hit",
    pointCost: 3,
    xpCost: 100,
    effects: {
      convertFocusToHit: 1,
      bonusDamageOnCrit: 1,
      condition: { type: "bullseye" },
    },
  },

  predator: {
    id: "predator",
    name: "Predator",
    category: "offensive",
    trigger: "on_attack",
    description:
      "When attacking, reroll 1 attack die. Reroll 2 if defender is damaged",
    pointCost: 4,
    xpCost: 150,
    effects: {
      rerollAttackDice: 1,
    },
  },

  crack_shot: {
    id: "crack_shot",
    name: "Crack Shot",
    category: "offensive",
    trigger: "on_attack",
    description:
      "When attacking from bullseye, defender cannot spend evade tokens",
    pointCost: 3,
    xpCost: 100,
    effects: {
      condition: { type: "bullseye" },
    },
  },

  outmaneuver: {
    id: "outmaneuver",
    name: "Outmaneuver",
    category: "offensive",
    trigger: "on_attack",
    description: "When attacking from outside defender's arc, +1 attack die",
    pointCost: 5,
    xpCost: 200,
    effects: {
      attackDiceBonus: 1,
      condition: { type: "behind_target" },
    },
  },

  ruthless: {
    id: "ruthless",
    name: "Ruthless",
    category: "offensive",
    trigger: "on_attack",
    description:
      "When attacking, deal 1 damage to a nearby ally to add 1 hit result",
    pointCost: 2,
    xpCost: 75,
    requiredFaction: "void_corsairs",
    effects: {
      attackDiceBonus: 1,
      condition: { type: "near_ally", distance: 100 },
    },
  },

  deadeye: {
    id: "deadeye",
    name: "Deadeye",
    category: "offensive",
    trigger: "on_attack",
    description: "Spend focus to treat target lock requirement as met",
    pointCost: 2,
    xpCost: 75,
    effects: {},
  },

  // ============================================
  // DEFENSIVE ABILITIES
  // ============================================
  stealth_device: {
    id: "stealth_device",
    name: "Stealth Device",
    category: "defensive",
    trigger: "passive",
    description: "+1 agility while not damaged",
    pointCost: 4,
    xpCost: 150,
    effects: {
      defenseDiceBonus: 1,
      condition: { type: "damaged", threshold: 0 },
    },
  },

  elusive: {
    id: "elusive",
    name: "Elusive",
    category: "defensive",
    trigger: "on_defend",
    description: "When defending, reroll 1 defense die. Recovers when stressed",
    pointCost: 3,
    xpCost: 100,
    effects: {
      rerollDefenseDice: 1,
    },
  },

  hull_upgrade: {
    id: "hull_upgrade",
    name: "Hull Upgrade",
    category: "defensive",
    trigger: "passive",
    description: "+1 hull point",
    pointCost: 3,
    xpCost: 100,
    effects: {},
  },

  shield_upgrade: {
    id: "shield_upgrade",
    name: "Shield Upgrade",
    category: "defensive",
    trigger: "passive",
    description: "+1 shield point",
    pointCost: 4,
    xpCost: 150,
    effects: {},
  },

  regenerative_shields: {
    id: "regenerative_shields",
    name: "Regenerative Shields",
    category: "defensive",
    trigger: "end_of_round",
    description: "At end of round, recover 1 shield if below maximum",
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "synthetic_collective",
    effects: {
      shieldRegen: 1,
    },
  },

  afterburners: {
    id: "afterburners",
    name: "Afterburners",
    category: "defensive",
    trigger: "on_maneuver",
    description: "After executing speed 3-5 maneuver, may perform free boost",
    pointCost: 4,
    xpCost: 150,
    effects: {
      freeBoostAfterManeuver: true,
    },
  },

  // ============================================
  // MOVEMENT ABILITIES
  // ============================================
  expert_handling: {
    id: "expert_handling",
    name: "Expert Handling",
    category: "movement",
    trigger: "on_action",
    description: "Barrel roll removes 1 enemy target lock on you",
    pointCost: 2,
    xpCost: 75,
    effects: {},
  },

  supernatural_reflexes: {
    id: "supernatural_reflexes",
    name: "Supernatural Reflexes",
    category: "movement",
    trigger: "start_of_round",
    description:
      "Before revealing dial, may barrel roll or boost (gain stress)",
    pointCost: 6,
    xpCost: 250,
    requiredFaction: "ascendant_empire",
    effects: {
      freeBoostAfterManeuver: true,
      freeBarrelRollAfterManeuver: true,
    },
  },

  debris_gambit: {
    id: "debris_gambit",
    name: "Debris Gambit",
    category: "movement",
    trigger: "passive",
    description: "+1 defense die when near obstacle. Ignore obstacle effects",
    pointCost: 3,
    xpCost: 100,
    effects: {
      defenseDiceBonus: 1,
      ignoreBumpDamage: true,
    },
  },

  daredevil: {
    id: "daredevil",
    name: "Daredevil",
    category: "movement",
    trigger: "on_maneuver",
    description: "White boost becomes red, but may rotate 90° after",
    pointCost: 2,
    xpCost: 75,
    requiredFaction: "void_corsairs",
    effects: {},
  },

  // ============================================
  // SUPPORT ABILITIES
  // ============================================
  squad_leader: {
    id: "squad_leader",
    name: "Squad Leader",
    category: "support",
    trigger: "activated",
    description: "Action: Friendly ship at range 1-2 may perform free action",
    minPilotSkill: 4,
    pointCost: 5,
    xpCost: 200,
    effects: {},
  },

  swarm_tactics: {
    id: "swarm_tactics",
    name: "Swarm Tactics",
    category: "support",
    trigger: "start_of_round",
    description:
      "At start of combat, friendly at range 1 uses your pilot skill",
    minPilotSkill: 3,
    pointCost: 4,
    xpCost: 150,
    requiredFaction: "synthetic_collective",
    effects: {},
  },

  jammer: {
    id: "jammer",
    name: "Jammer",
    category: "support",
    trigger: "on_defend",
    description: "When ally at range 0-1 defends, attacker rerolls 1 die",
    pointCost: 3,
    xpCost: 100,
    effects: {},
  },

  // ============================================
  // SPECIAL ABILITIES
  // ============================================
  lone_wolf: {
    id: "lone_wolf",
    name: "Lone Wolf",
    category: "special",
    trigger: "passive",
    description:
      "When no allies at range 0-2, reroll 1 attack and 1 defense die",
    pointCost: 4,
    xpCost: 150,
    effects: {
      rerollAttackDice: 1,
      rerollDefenseDice: 1,
    },
  },

  intimidation: {
    id: "intimidation",
    name: "Intimidation",
    category: "special",
    trigger: "on_attack",
    description:
      "When attacking at range 1, defender rolls 1 fewer defense die",
    pointCost: 3,
    xpCost: 100,
    requiredFaction: "terran_hegemony",
    effects: {
      condition: { type: "range", value: 1 },
    },
  },

  fanatical: {
    id: "fanatical",
    name: "Fanatical",
    category: "special",
    trigger: "on_attack",
    description: "When attacking while damaged, +1 attack die",
    pointCost: 2,
    xpCost: 75,
    effects: {
      attackDiceBonus: 1,
      condition: { type: "damaged", threshold: 1 },
    },
  },

  sense: {
    id: "sense",
    name: "Sense",
    category: "special",
    trigger: "start_of_round",
    description: "Look at an enemy's dial before choosing your maneuver",
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "ascendant_empire",
    effects: {},
  },

  // ============================================
  // ADDITIONAL OFFENSIVE ABILITIES
  // ============================================

  fearless: {
    id: "fearless",
    name: "Fearless",
    category: "offensive",
    trigger: "on_attack",
    description: "When attacking while stressed, roll 1 additional attack die",
    pointCost: 3,
    xpCost: 100,
    effects: {
      attackDiceBonus: 1,
      condition: { type: "stressed" },
    },
  },

  dead_eye: {
    id: "dead_eye",
    name: "Dead Eye",
    category: "offensive",
    trigger: "on_attack",
    description:
      "When attacking a target in your bullseye arc, you may spend a target lock to convert all focuses to crits",
    pointCost: 4,
    xpCost: 150,
    effects: {
      bonusDamageOnCrit: 1,
      condition: { type: "bullseye" },
    },
  },

  heavy_gunner: {
    id: "heavy_gunner",
    name: "Heavy Gunner",
    category: "offensive",
    trigger: "on_attack",
    description: "When attacking at range 1, roll 1 additional attack die",
    pointCost: 3,
    xpCost: 100,
    effects: {
      attackDiceBonus: 1,
      condition: { type: "range", value: 1 },
    },
  },

  marksman: {
    id: "marksman",
    name: "Marksman",
    category: "offensive",
    trigger: "on_attack",
    description: "When attacking, convert 1 focus result to a hit",
    pointCost: 2,
    xpCost: 75,
    effects: {
      convertFocusToHit: 1,
    },
  },

  bombardier: {
    id: "bombardier",
    name: "Bombardier",
    category: "offensive",
    trigger: "on_action",
    description:
      "When dropping a bomb, you may also drop a second bomb without spending an additional action",
    pointCost: 4,
    xpCost: 150,
    requiredShipRole: "bomber",
    effects: {
      freeActionOnActivate: "evade", // Approximates the extra ordnance action; full double-drop requires effect type expansion
    },
  },

  // ============================================
  // ADDITIONAL DEFENSIVE ABILITIES
  // ============================================

  stalwart: {
    id: "stalwart",
    name: "Stalwart",
    category: "defensive",
    trigger: "on_defend",
    description:
      "Once per round when defending, you may reroll all of your defense dice",
    minPilotSkill: 3,
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "terran_hegemony",
    effects: {
      rerollDefenseDice: 3,
    },
  },

  // ============================================
  // ADDITIONAL MOVEMENT ABILITIES
  // ============================================

  phantom_strike: {
    id: "phantom_strike",
    name: "Phantom Strike",
    category: "movement",
    trigger: "on_maneuver",
    description:
      "After executing a maneuver that ends in an enemy's rear arc, gain +1 attack die on your next attack",
    minPilotSkill: 3,
    pointCost: 4,
    xpCost: 150,
    requiredFaction: "void_corsairs",
    effects: {
      attackDiceBonus: 1,
      condition: { type: "behind_target" },
    },
  },

  prescience: {
    id: "prescience",
    name: "Prescience",
    category: "movement",
    trigger: "start_of_round",
    description:
      "At the start of the Planning Phase, you may look at 1 enemy ship's chosen maneuver",
    minPilotSkill: 4,
    pointCost: 6,
    xpCost: 250,
    requiredFaction: "ascendant_empire",
    effects: {},
  },

  // ============================================
  // ADDITIONAL SUPPORT ABILITIES
  // ============================================

  coordinated_assault: {
    id: "coordinated_assault",
    name: "Coordinated Assault",
    category: "support",
    trigger: "activated",
    description:
      "Action: Choose a friendly ship at range 1-2. It may perform a free Focus or Target Lock action",
    minPilotSkill: 4,
    pointCost: 5,
    xpCost: 200,
    effects: {
      freeActionOnActivate: "focus",
    },
  },

  inspiring_presence: {
    id: "inspiring_presence",
    name: "Inspiring Presence",
    category: "support",
    trigger: "start_of_round",
    description:
      "At the start of each round, remove 1 stress token from each friendly ship at range 1-2",
    minPilotSkill: 4,
    pointCost: 6,
    xpCost: 250,
    effects: {
      condition: { type: "near_ally", distance: 200 },
    },
  },

  shield_transfer: {
    id: "shield_transfer",
    name: "Shield Transfer",
    category: "support",
    trigger: "activated",
    description:
      "Action: Lose 1 shield to restore 1 shield on a friendly ship at range 1",
    pointCost: 4,
    xpCost: 150,
    effects: {
      shieldRegen: 1,
      condition: { type: "near_ally", distance: 100 },
    },
  },

  healing_aura: {
    id: "healing_aura",
    name: "Healing Aura",
    category: "support",
    trigger: "start_of_round",
    description:
      "At the start of each round, friendly ships at range 0-1 recover 1 shield",
    minPilotSkill: 3,
    pointCost: 6,
    xpCost: 250,
    requiredFaction: "free_confederation",
    effects: {
      shieldRegen: 1,
      condition: { type: "near_ally", distance: 100 },
    },
  },

  force_heal: {
    id: "force_heal",
    name: "Force Heal",
    category: "support",
    trigger: "activated",
    description:
      "Action: Spend 1 Force charge to restore 2 shields on yourself or a friendly at range 1",
    minPilotSkill: 3,
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "ascendant_empire",
    effects: {
      shieldRegen: 2,
    },
  },

  force_guidance: {
    id: "force_guidance",
    name: "Force Guidance",
    category: "support",
    trigger: "activated",
    description:
      "Spend 1 Force charge to give a friendly ship at range 1-3 a free Focus action",
    minPilotSkill: 3,
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "ascendant_empire",
    effects: {
      freeActionOnActivate: "focus",
    },
  },

  networked_aim: {
    id: "networked_aim",
    name: "Networked Aim",
    category: "support",
    trigger: "start_of_round",
    description:
      "Friendly ships at range 0-2 may use your target lock for their attacks",
    minPilotSkill: 3,
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "synthetic_collective",
    effects: {},
  },

  informant: {
    id: "informant",
    name: "Informant",
    category: "support",
    trigger: "start_of_round",
    description:
      "At the start of each round, reveal 1 enemy ship's planned maneuver to all friendlies",
    pointCost: 3,
    xpCost: 100,
    effects: {},
  },

  // ============================================
  // ADDITIONAL SPECIAL ABILITIES
  // ============================================

  hive_mind: {
    id: "hive_mind",
    name: "Hive Mind",
    category: "special",
    trigger: "start_of_round",
    description:
      "For each friendly ship at range 0-1 (max 2), gain +1 attack die during combat",
    minPilotSkill: 4,
    pointCost: 6,
    xpCost: 250,
    requiredFaction: "synthetic_collective",
    effects: {
      attackDiceBonus: 2,
      condition: { type: "near_ally", distance: 100 },
    },
  },

  force_push: {
    id: "force_push",
    name: "Force Push",
    category: "special",
    trigger: "activated",
    description:
      "Action: Spend 1 Force charge. An enemy ship at range 1-2 gains 1 stress token",
    minPilotSkill: 4,
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "ascendant_empire",
    effects: {},
  },

  // ============================================
  // CAMPAIGN PROGRESSION ABILITIES
  // ============================================

  focus_mastery: {
    id: "focus_mastery",
    name: "Focus Mastery",
    category: "special",
    trigger: "on_action",
    description:
      "When you perform a Focus action, gain 2 focus tokens instead of 1",
    pointCost: 4,
    xpCost: 150,
    effects: {
      doubleTokens: "focus",
    },
  },

  target_lock_mastery: {
    id: "target_lock_mastery",
    name: "Target Lock Mastery",
    category: "offensive",
    trigger: "on_action",
    description:
      "When you perform a Target Lock action, you may lock two ships simultaneously",
    pointCost: 4,
    xpCost: 150,
    effects: {},
  },

  barrel_roll_efficiency: {
    id: "barrel_roll_efficiency",
    name: "Barrel Roll Efficiency",
    category: "movement",
    trigger: "on_action",
    description:
      "When you perform a Barrel Roll, you do not gain a stress token",
    pointCost: 3,
    xpCost: 100,
    effects: {
      stressImmunity: true,
    },
  },

  boost_expertise: {
    id: "boost_expertise",
    name: "Boost Expertise",
    category: "movement",
    trigger: "on_action",
    description:
      "After performing a Boost action, you may rotate your arc indicator for free",
    pointCost: 3,
    xpCost: 100,
    effects: {
      freeBoostAfterManeuver: true,
    },
  },

  evade_mastery: {
    id: "evade_mastery",
    name: "Evade Mastery",
    category: "defensive",
    trigger: "on_defend",
    description: "When you spend an evade token, cancel 2 hits instead of 1",
    pointCost: 5,
    xpCost: 200,
    effects: {
      damageReduction: 1,
    },
  },

  stress_recovery: {
    id: "stress_recovery",
    name: "Stress Recovery",
    category: "movement",
    trigger: "end_of_round",
    description:
      "At the end of each round, remove 1 stress token from yourself",
    pointCost: 3,
    xpCost: 100,
    effects: {},
  },

  wingman: {
    id: "wingman",
    name: "Wingman",
    category: "support",
    trigger: "on_defend",
    description:
      "When a friendly ship at range 0-1 defends, you may spend your evade token to cancel 1 additional hit against them",
    pointCost: 4,
    xpCost: 150,
    effects: {
      condition: { type: "near_ally", distance: 100 },
    },
  },

  predatory_instinct: {
    id: "predatory_instinct",
    name: "Predatory Instinct",
    category: "offensive",
    trigger: "on_attack",
    description: "When attacking a damaged ship, roll 1 additional attack die",
    pointCost: 3,
    xpCost: 100,
    effects: {
      attackDiceBonus: 1,
      condition: { type: "damaged", threshold: 1 },
    },
  },

  defensive_flying: {
    id: "defensive_flying",
    name: "Defensive Flying",
    category: "defensive",
    trigger: "on_action",
    description:
      "After performing a Barrel Roll or Boost action, gain 1 evade token",
    pointCost: 4,
    xpCost: 150,
    effects: {
      freeActionOnActivate: "evade",
    },
  },

  tenacity: {
    id: "tenacity",
    name: "Tenacity",
    category: "special",
    trigger: "passive",
    description:
      "While your hull is below 50%, roll 1 additional attack die and 1 additional defense die",
    pointCost: 5,
    xpCost: 200,
    effects: {
      attackDiceBonus: 1,
      defenseDiceBonus: 1,
      condition: { type: "damaged", threshold: 1 },
    },
  },

  // ============================================
  // FACTION-SIGNATURE ABILITIES — TERRAN HEGEMONY
  // Elite, disciplined formation fighting and firepower.
  // ============================================

  hold_the_line: {
    id: "hold_the_line",
    name: "Hold the Line",
    category: "defensive",
    trigger: "on_defend",
    description:
      "While a friendly ship is at range 0-1, roll 1 additional defense die and deal +1 damage",
    pointCost: 4,
    xpCost: 150,
    requiredFaction: "terran_hegemony",
    effects: {
      defenseDiceBonus: 1,
      condition: { type: "near_ally", distance: 100 },
    },
  },

  focused_volley: {
    id: "focused_volley",
    name: "Focused Volley",
    category: "offensive",
    trigger: "on_attack",
    description:
      "When attacking a ship that a friendly ship is also engaging, add 1 attack die",
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "terran_hegemony",
    effects: {
      attackDiceBonus: 1,
      condition: { type: "near_ally", distance: 100 },
    },
  },

  iron_discipline: {
    id: "iron_discipline",
    name: "Iron Discipline",
    category: "special",
    trigger: "passive",
    description: "The first stress token you would gain each round is ignored",
    pointCost: 4,
    xpCost: 150,
    requiredFaction: "terran_hegemony",
    effects: {
      stressImmunity: true,
    },
  },

  // ============================================
  // FACTION-SIGNATURE ABILITIES — FREE CONFEDERATION
  // Versatile, mobile hit-and-fade with medical support.
  // ============================================

  covering_fire: {
    id: "covering_fire",
    name: "Covering Fire",
    category: "support",
    trigger: "on_defend",
    description:
      "When a friendly ship at range 0-1 defends, it may reroll 1 defense die",
    pointCost: 4,
    xpCost: 150,
    requiredFaction: "free_confederation",
    effects: {
      rerollDefenseDice: 1,
      condition: { type: "near_ally", distance: 100 },
    },
  },

  evasive_roll: {
    id: "evasive_roll",
    name: "Evasive Roll",
    category: "movement",
    trigger: "on_defend",
    description: "After you defend, you may perform a free Barrel Roll action",
    pointCost: 4,
    xpCost: 150,
    requiredFaction: "free_confederation",
    effects: {
      freeBarrelRollAfterManeuver: true,
    },
  },

  rapid_redeploy: {
    id: "rapid_redeploy",
    name: "Rapid Redeploy",
    category: "movement",
    trigger: "on_maneuver",
    description:
      "After you execute a white maneuver, you may perform a free Boost action",
    pointCost: 4,
    xpCost: 150,
    requiredFaction: "free_confederation",
    effects: {
      freeBoostAfterManeuver: true,
    },
  },

  guerrilla_tactics: {
    id: "guerrilla_tactics",
    name: "Guerrilla Tactics",
    category: "offensive",
    trigger: "on_attack",
    description:
      "When attacking from outside the defender's firing arc, add 1 attack die",
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "free_confederation",
    effects: {
      attackDiceBonus: 1,
      condition: { type: "behind_target" },
    },
  },

  rally: {
    id: "rally",
    name: "Rally",
    category: "support",
    trigger: "activated",
    description:
      "Action: remove 1 stress token from a friendly ship at range 1-2",
    pointCost: 4,
    xpCost: 150,
    requiredFaction: "free_confederation",
    effects: {},
  },

  // ============================================
  // FACTION-SIGNATURE ABILITIES — VOID CORSAIRS
  // Fast raiders: hit-and-run, plunder, reckless aggression.
  // ============================================

  ambush: {
    id: "ambush",
    name: "Ambush",
    category: "offensive",
    trigger: "on_attack",
    description: "When attacking a ship at full health, add 1 attack die",
    pointCost: 4,
    xpCost: 150,
    requiredFaction: "void_corsairs",
    effects: {
      attackDiceBonus: 1,
    },
  },

  hit_and_run: {
    id: "hit_and_run",
    name: "Hit and Run",
    category: "movement",
    trigger: "on_attack",
    description:
      "After you perform an attack, you may perform a free Boost action",
    pointCost: 4,
    xpCost: 150,
    requiredFaction: "void_corsairs",
    effects: {
      freeBoostAfterManeuver: true,
    },
  },

  blood_frenzy: {
    id: "blood_frenzy",
    name: "Blood Frenzy",
    category: "special",
    trigger: "on_kill",
    description:
      "After you destroy an enemy ship, roll 1 additional attack die for the rest of the game",
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "void_corsairs",
    effects: {
      attackDiceBonus: 1,
    },
  },

  smugglers_luck: {
    id: "smugglers_luck",
    name: "Smuggler's Luck",
    category: "defensive",
    trigger: "on_defend",
    description: "Once per game, you may reroll all of your defense dice",
    pointCost: 3,
    xpCost: 100,
    requiredFaction: "void_corsairs",
    effects: {
      rerollDefenseDice: 3,
    },
  },

  raider_cadence: {
    id: "raider_cadence",
    name: "Raider Cadence",
    category: "movement",
    trigger: "on_maneuver",
    description:
      "When you execute a red maneuver, you do not gain a stress token",
    pointCost: 4,
    xpCost: 150,
    requiredFaction: "void_corsairs",
    effects: {
      stressImmunity: true,
    },
  },

  // ============================================
  // FACTION-SIGNATURE ABILITIES — SYNTHETIC COLLECTIVE
  // Networked swarm calculation and self-sacrifice.
  // ============================================

  calculate_strike: {
    id: "calculate_strike",
    name: "Calculate Strike",
    category: "offensive",
    trigger: "on_attack",
    description:
      "When attacking, you may convert 1 blank result to a focus result",
    pointCost: 4,
    xpCost: 150,
    requiredFaction: "synthetic_collective",
    effects: {
      convertBlankToFocus: 1,
    },
  },

  drone_overclock: {
    id: "drone_overclock",
    name: "Drone Overclock",
    category: "movement",
    trigger: "passive",
    description: "Gain +1 speed on your maneuvers",
    pointCost: 4,
    xpCost: 150,
    requiredFaction: "synthetic_collective",
    effects: {
      speedBonus: 1,
    },
  },

  saturation_fire: {
    id: "saturation_fire",
    name: "Saturation Fire",
    category: "offensive",
    trigger: "on_attack",
    description: "When attacking at range 1, roll 1 additional attack die",
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "synthetic_collective",
    effects: {
      attackDiceBonus: 1,
      condition: { type: "range", value: 1 },
    },
  },

  regenerative_matrix: {
    id: "regenerative_matrix",
    name: "Regenerative Matrix",
    category: "defensive",
    trigger: "end_of_round",
    description: "At the end of each round, recover 1 shield",
    pointCost: 4,
    xpCost: 150,
    requiredFaction: "synthetic_collective",
    effects: {
      shieldRegen: 1,
    },
  },

  data_link: {
    id: "data_link",
    name: "Data Link",
    category: "support",
    trigger: "start_of_round",
    description: "Friendly ships at range 0-2 may reroll 1 attack die",
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "synthetic_collective",
    effects: {
      rerollAttackDice: 1,
      condition: { type: "near_ally", distance: 100 },
    },
  },

  assimilation: {
    id: "assimilation",
    name: "Assimilation",
    category: "special",
    trigger: "on_kill",
    description:
      "After a friendly ship at range 0-1 is destroyed, gain 1 focus token",
    pointCost: 3,
    xpCost: 100,
    requiredFaction: "synthetic_collective",
    effects: {
      condition: { type: "near_ally", distance: 100 },
    },
  },

  // ============================================
  // FACTION-SIGNATURE ABILITIES — ASCENDANT EMPIRE
  // The Force: faith, protection, divine retribution.
  // ============================================

  force_barrier: {
    id: "force_barrier",
    name: "Force Barrier",
    category: "support",
    trigger: "activated",
    description:
      "Action: Spend 1 Force charge to give a friendly ship at range 1-2 an evade token",
    minPilotSkill: 3,
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "ascendant_empire",
    effects: {
      freeActionOnActivate: "evade",
    },
  },

  radiant_judgment: {
    id: "radiant_judgment",
    name: "Radiant Judgment",
    category: "defensive",
    trigger: "on_defend",
    description:
      "After you defend against an attacker at range 1, deal 1 damage to that attacker",
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "ascendant_empire",
    effects: {
      condition: { type: "range", value: 1 },
    },
  },

  // ============================================
  // PREVIOUSLY-REFERENCED SIGNATURE ABILITIES
  // These abilityIds were used by hero cards but had no definition.
  // ============================================

  plunder: {
    id: "plunder",
    name: "Plunder",
    category: "special",
    trigger: "on_kill",
    description:
      "After you destroy an enemy ship, gain 1 focus token and 1 evade token",
    pointCost: 4,
    xpCost: 150,
    requiredFaction: "void_corsairs",
    effects: {},
  },

  convergence_strike: {
    id: "convergence_strike",
    name: "Convergence Strike",
    category: "offensive",
    trigger: "on_attack",
    description:
      "For each other friendly ship engaging the same target (max 2), add 1 attack die",
    minPilotSkill: 4,
    pointCost: 6,
    xpCost: 250,
    requiredFaction: "synthetic_collective",
    effects: {
      attackDiceBonus: 2,
      condition: { type: "near_ally", distance: 100 },
    },
  },

  self_destruct: {
    id: "self_destruct",
    name: "Self-Destruct",
    category: "special",
    trigger: "on_damage",
    description: "When destroyed, deal 2 damage to all ships at range 0-1",
    pointCost: 4,
    xpCost: 150,
    requiredFaction: "synthetic_collective",
    effects: {},
  },

  force_shield: {
    id: "force_shield",
    name: "Force Shield",
    category: "defensive",
    trigger: "activated",
    description:
      "Action: Spend 1 Force charge to gain 2 shields until the end of the round",
    minPilotSkill: 3,
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "ascendant_empire",
    effects: {
      shieldRegen: 2,
    },
  },

  force_fury: {
    id: "force_fury",
    name: "Force Fury",
    category: "offensive",
    trigger: "on_attack",
    description: "Spend 1 Force charge when attacking to add 1 hit result",
    minPilotSkill: 4,
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "ascendant_empire",
    effects: {},
  },

  force_suppression: {
    id: "force_suppression",
    name: "Force Suppression",
    category: "special",
    trigger: "activated",
    description:
      "Action: Spend 1 Force charge. An enemy at range 1-2 cannot perform actions next round",
    minPilotSkill: 4,
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "ascendant_empire",
    effects: {},
  },

  righteous_anger: {
    id: "righteous_anger",
    name: "Righteous Anger",
    category: "special",
    trigger: "passive",
    description:
      "While damaged, roll 1 additional attack die and ignore stress",
    pointCost: 5,
    xpCost: 200,
    requiredFaction: "ascendant_empire",
    effects: {
      attackDiceBonus: 1,
      stressImmunity: true,
      condition: { type: "damaged", threshold: 1 },
    },
  },
};

// ============================================
// Pilot State
// ============================================

export interface PilotState {
  readonly pilotSkill: number; // 1-6, determines activation order
  readonly abilities: string[]; // IDs of equipped abilities
  readonly xpEarned: number;
  readonly unlockedAbilities: string[]; // IDs of abilities available to equip
}

// ============================================
// Ability Functions
// ============================================

/**
 * Check if an ability can be equipped on a ship
 */
export function canEquipAbility(
  ability: PilotAbility,
  ship: { faction: FactionId; role: string; pilotSkill: number },
  currentAbilities: string[],
): { valid: boolean; reason?: string } {
  // Check faction requirement
  if (ability.requiredFaction && ability.requiredFaction !== ship.faction) {
    return {
      valid: false,
      reason: `Requires ${ability.requiredFaction} faction`,
    };
  }

  // Check pilot skill requirement
  if (ability.minPilotSkill && ship.pilotSkill < ability.minPilotSkill) {
    return {
      valid: false,
      reason: `Requires pilot skill ${ability.minPilotSkill}+`,
    };
  }

  // Check incompatibilities
  if (ability.incompatibleWith) {
    for (const incompatible of ability.incompatibleWith) {
      if (currentAbilities.includes(incompatible)) {
        return {
          valid: false,
          reason: `Incompatible with ${PILOT_ABILITIES[incompatible]?.name}`,
        };
      }
    }
  }

  // Check if already equipped
  if (currentAbilities.includes(ability.id)) {
    return { valid: false, reason: "Already equipped" };
  }

  return { valid: true };
}

/**
 * Get abilities available to unlock for a faction
 */
export function getUnlockableAbilities(
  faction: FactionId,
  currentXp: number,
  alreadyUnlocked: string[],
): PilotAbility[] {
  return Object.values(PILOT_ABILITIES)
    .filter((ability) => {
      // Not already unlocked
      if (alreadyUnlocked.includes(ability.id)) return false;

      // Has enough XP
      if (currentXp < ability.xpCost) return false;

      // Matches faction (or no faction requirement)
      if (ability.requiredFaction && ability.requiredFaction !== faction) {
        return false;
      }

      return true;
    })
    .sort((a, b) => a.xpCost - b.xpCost);
}

/**
 * Calculate total point cost of equipped abilities
 */
export function calculateAbilitiesCost(abilityIds: string[]): number {
  return abilityIds.reduce((total, id) => {
    const ability = PILOT_ABILITIES[id];
    return total + (ability?.pointCost ?? 0);
  }, 0);
}

/**
 * Get abilities that trigger at a specific time
 */
export function getAbilitiesForTrigger(
  abilityIds: string[],
  trigger: AbilityTrigger,
): PilotAbility[] {
  return abilityIds
    .map((id) => PILOT_ABILITIES[id])
    .filter(
      (ability): ability is PilotAbility =>
        ability !== undefined && ability.trigger === trigger,
    );
}

/**
 * Check if an ability's condition is met
 */
export function isAbilityConditionMet(
  condition: AbilityCondition | undefined,
  context: {
    attacker: ShipState;
    defender?: ShipState;
    range?: number;
    inBullseye?: boolean;
    nearbyAllies?: ShipState[];
  },
): boolean {
  if (!condition) return true;

  switch (condition.type) {
    case "range":
      return context.range === condition.value;

    case "bullseye":
      return context.inBullseye === true;

    case "behind_target": {
      if (!context.defender) return false;
      // Attacker is "behind target" when in the defender's rear arc (±45° of defender's reverse facing)
      const angleFromDefenderToAttacker = angleToTarget(
        context.defender.x,
        context.defender.y,
        context.attacker.x,
        context.attacker.y,
      );
      return isInArc(
        context.defender.angle + 180,
        angleFromDefenderToAttacker,
        90,
      );
    }

    case "stressed":
      return context.attacker.isStressed;

    case "damaged":
      return (
        context.attacker.hull < context.attacker.maxHull - condition.threshold
      );

    case "outnumbered": {
      const allyCount = context.nearbyAllies?.length ?? 0;
      return allyCount === 0;
    }

    case "near_ally":
      if (!context.nearbyAllies) return false;
      return context.nearbyAllies.some((ally) => {
        const dx = ally.x - context.attacker.x;
        const dy = ally.y - context.attacker.y;
        return Math.sqrt(dx * dx + dy * dy) <= condition.distance;
      });

    default:
      return true;
  }
}

/**
 * Apply passive ability effects to ship stats
 */
export function applyPassiveAbilities(
  ship: ShipState,
  abilityIds: string[],
): {
  hullBonus: number;
  shieldBonus: number;
  agilityBonus: number;
} {
  let hullBonus = 0;
  let shieldBonus = 0;
  let agilityBonus = 0;

  for (const id of abilityIds) {
    const ability = PILOT_ABILITIES[id];
    if (!ability || ability.trigger !== "passive") continue;

    if (id === "hull_upgrade") {
      hullBonus += 1;
    }
    if (id === "shield_upgrade") {
      shieldBonus += 1;
    }
    if (id === "stealth_device" && ship.hull === ship.maxHull) {
      agilityBonus += 1;
    }
  }

  return { hullBonus, shieldBonus, agilityBonus };
}
