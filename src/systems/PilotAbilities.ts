/**
 * Pilot Abilities System
 *
 * Individual pilot skills, talents, and upgrades that can be
 * earned through campaign progression or purchased in squad building.
 */

import type { ShipState, ActionType } from '../core/types';
import type { FactionId } from '../config';

// ============================================
// Ability Categories
// ============================================

export type AbilityCategory =
  | 'offensive' // Attack bonuses
  | 'defensive' // Defense bonuses
  | 'movement' // Maneuver benefits
  | 'support' // Team buffs
  | 'special'; // Unique mechanics

export type AbilityTrigger =
  | 'passive' // Always active
  | 'on_attack' // When attacking
  | 'on_defend' // When defending
  | 'on_maneuver' // After executing maneuver
  | 'on_action' // When performing action
  | 'on_damage' // When taking damage
  | 'on_kill' // When destroying an enemy
  | 'start_of_round' // Beginning of each round
  | 'end_of_round' // End of each round
  | 'activated'; // Must be manually activated (uses action)

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
  | { type: 'range'; value: 1 | 2 | 3 }
  | { type: 'bullseye' }
  | { type: 'behind_target' }
  | { type: 'stressed' }
  | { type: 'damaged'; threshold: number }
  | { type: 'outnumbered' }
  | { type: 'near_ally'; distance: number };

// ============================================
// Pilot Ability Definitions
// ============================================

export const PILOT_ABILITIES: Record<string, PilotAbility> = {
  // ============================================
  // OFFENSIVE ABILITIES
  // ============================================
  marksmanship: {
    id: 'marksmanship',
    name: 'Marksmanship',
    category: 'offensive',
    trigger: 'on_attack',
    description: 'When attacking, you may convert 1 focus to a critical hit',
    pointCost: 3,
    xpCost: 100,
    effects: {
      convertFocusToHit: 1,
      bonusDamageOnCrit: 1,
      condition: { type: 'bullseye' },
    },
  },

  predator: {
    id: 'predator',
    name: 'Predator',
    category: 'offensive',
    trigger: 'on_attack',
    description: 'When attacking, reroll 1 attack die. Reroll 2 if defender is damaged',
    pointCost: 4,
    xpCost: 150,
    effects: {
      rerollAttackDice: 1,
    },
  },

  crack_shot: {
    id: 'crack_shot',
    name: 'Crack Shot',
    category: 'offensive',
    trigger: 'on_attack',
    description: 'When attacking from bullseye, defender cannot spend evade tokens',
    pointCost: 3,
    xpCost: 100,
    effects: {
      condition: { type: 'bullseye' },
    },
  },

  outmaneuver: {
    id: 'outmaneuver',
    name: 'Outmaneuver',
    category: 'offensive',
    trigger: 'on_attack',
    description: 'When attacking from outside defender\'s arc, +1 attack die',
    pointCost: 5,
    xpCost: 200,
    effects: {
      attackDiceBonus: 1,
      condition: { type: 'behind_target' },
    },
  },

  ruthless: {
    id: 'ruthless',
    name: 'Ruthless',
    category: 'offensive',
    trigger: 'on_attack',
    description: 'When attacking, deal 1 damage to a nearby ally to add 1 hit result',
    pointCost: 2,
    xpCost: 75,
    requiredFaction: 'void_corsairs',
    effects: {
      attackDiceBonus: 1,
      condition: { type: 'near_ally', distance: 100 },
    },
  },

  deadeye: {
    id: 'deadeye',
    name: 'Deadeye',
    category: 'offensive',
    trigger: 'on_attack',
    description: 'Spend focus to treat target lock requirement as met',
    pointCost: 2,
    xpCost: 75,
    effects: {},
  },

  // ============================================
  // DEFENSIVE ABILITIES
  // ============================================
  stealth_device: {
    id: 'stealth_device',
    name: 'Stealth Device',
    category: 'defensive',
    trigger: 'passive',
    description: '+1 agility while not damaged',
    pointCost: 4,
    xpCost: 150,
    effects: {
      defenseDiceBonus: 1,
      condition: { type: 'damaged', threshold: 0 },
    },
  },

  elusive: {
    id: 'elusive',
    name: 'Elusive',
    category: 'defensive',
    trigger: 'on_defend',
    description: 'When defending, reroll 1 defense die. Recovers when stressed',
    pointCost: 3,
    xpCost: 100,
    effects: {
      rerollDefenseDice: 1,
    },
  },

  hull_upgrade: {
    id: 'hull_upgrade',
    name: 'Hull Upgrade',
    category: 'defensive',
    trigger: 'passive',
    description: '+1 hull point',
    pointCost: 3,
    xpCost: 100,
    effects: {},
  },

  shield_upgrade: {
    id: 'shield_upgrade',
    name: 'Shield Upgrade',
    category: 'defensive',
    trigger: 'passive',
    description: '+1 shield point',
    pointCost: 4,
    xpCost: 150,
    effects: {},
  },

  regenerative_shields: {
    id: 'regenerative_shields',
    name: 'Regenerative Shields',
    category: 'defensive',
    trigger: 'end_of_round',
    description: 'At end of round, recover 1 shield if below maximum',
    pointCost: 5,
    xpCost: 200,
    requiredFaction: 'synthetic_collective',
    effects: {
      shieldRegen: 1,
    },
  },

  afterburners: {
    id: 'afterburners',
    name: 'Afterburners',
    category: 'defensive',
    trigger: 'on_maneuver',
    description: 'After executing speed 3-5 maneuver, may perform free boost',
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
    id: 'expert_handling',
    name: 'Expert Handling',
    category: 'movement',
    trigger: 'on_action',
    description: 'Barrel roll removes 1 enemy target lock on you',
    pointCost: 2,
    xpCost: 75,
    effects: {},
  },

  supernatural_reflexes: {
    id: 'supernatural_reflexes',
    name: 'Supernatural Reflexes',
    category: 'movement',
    trigger: 'start_of_round',
    description: 'Before revealing dial, may barrel roll or boost (gain stress)',
    pointCost: 6,
    xpCost: 250,
    requiredFaction: 'ascendant_empire',
    effects: {
      freeBoostAfterManeuver: true,
      freeBarrelRollAfterManeuver: true,
    },
  },

  debris_gambit: {
    id: 'debris_gambit',
    name: 'Debris Gambit',
    category: 'movement',
    trigger: 'passive',
    description: '+1 defense die when near obstacle. Ignore obstacle effects',
    pointCost: 3,
    xpCost: 100,
    effects: {
      defenseDiceBonus: 1,
      ignoreBumpDamage: true,
    },
  },

  daredevil: {
    id: 'daredevil',
    name: 'Daredevil',
    category: 'movement',
    trigger: 'on_maneuver',
    description: 'White boost becomes red, but may rotate 90° after',
    pointCost: 2,
    xpCost: 75,
    requiredFaction: 'free_confederation',
    effects: {},
  },

  // ============================================
  // SUPPORT ABILITIES
  // ============================================
  squad_leader: {
    id: 'squad_leader',
    name: 'Squad Leader',
    category: 'support',
    trigger: 'activated',
    description: 'Action: Friendly ship at range 1-2 may perform free action',
    minPilotSkill: 4,
    pointCost: 5,
    xpCost: 200,
    effects: {},
  },

  swarm_tactics: {
    id: 'swarm_tactics',
    name: 'Swarm Tactics',
    category: 'support',
    trigger: 'start_of_round',
    description: 'At start of combat, friendly at range 1 uses your pilot skill',
    minPilotSkill: 3,
    pointCost: 4,
    xpCost: 150,
    requiredFaction: 'terran_hegemony',
    effects: {},
  },

  jammer: {
    id: 'jammer',
    name: 'Jammer',
    category: 'support',
    trigger: 'on_defend',
    description: 'When ally at range 0-1 defends, attacker rerolls 1 die',
    pointCost: 3,
    xpCost: 100,
    effects: {},
  },

  // ============================================
  // SPECIAL ABILITIES
  // ============================================
  lone_wolf: {
    id: 'lone_wolf',
    name: 'Lone Wolf',
    category: 'special',
    trigger: 'passive',
    description: 'When no allies at range 0-2, reroll 1 attack and 1 defense die',
    pointCost: 4,
    xpCost: 150,
    effects: {
      rerollAttackDice: 1,
      rerollDefenseDice: 1,
    },
  },

  intimidation: {
    id: 'intimidation',
    name: 'Intimidation',
    category: 'special',
    trigger: 'on_attack',
    description: 'When attacking at range 1, defender rolls 1 fewer defense die',
    pointCost: 3,
    xpCost: 100,
    requiredFaction: 'void_corsairs',
    effects: {
      condition: { type: 'range', value: 1 },
    },
  },

  fanatical: {
    id: 'fanatical',
    name: 'Fanatical',
    category: 'special',
    trigger: 'on_attack',
    description: 'When attacking while damaged, +1 attack die',
    pointCost: 2,
    xpCost: 75,
    effects: {
      attackDiceBonus: 1,
      condition: { type: 'damaged', threshold: 1 },
    },
  },

  sense: {
    id: 'sense',
    name: 'Sense',
    category: 'special',
    trigger: 'start_of_round',
    description: 'Look at an enemy\'s dial before choosing your maneuver',
    pointCost: 5,
    xpCost: 200,
    requiredFaction: 'ascendant_empire',
    effects: {},
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
  currentAbilities: string[]
): { valid: boolean; reason?: string } {
  // Check faction requirement
  if (ability.requiredFaction && ability.requiredFaction !== ship.faction) {
    return { valid: false, reason: `Requires ${ability.requiredFaction} faction` };
  }

  // Check pilot skill requirement
  if (ability.minPilotSkill && ship.pilotSkill < ability.minPilotSkill) {
    return { valid: false, reason: `Requires pilot skill ${ability.minPilotSkill}+` };
  }

  // Check incompatibilities
  if (ability.incompatibleWith) {
    for (const incompatible of ability.incompatibleWith) {
      if (currentAbilities.includes(incompatible)) {
        return { valid: false, reason: `Incompatible with ${PILOT_ABILITIES[incompatible]?.name}` };
      }
    }
  }

  // Check if already equipped
  if (currentAbilities.includes(ability.id)) {
    return { valid: false, reason: 'Already equipped' };
  }

  return { valid: true };
}

/**
 * Get abilities available to unlock for a faction
 */
export function getUnlockableAbilities(
  faction: FactionId,
  currentXp: number,
  alreadyUnlocked: string[]
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
  trigger: AbilityTrigger
): PilotAbility[] {
  return abilityIds
    .map((id) => PILOT_ABILITIES[id])
    .filter((ability): ability is PilotAbility => ability !== undefined && ability.trigger === trigger);
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
  }
): boolean {
  if (!condition) return true;

  switch (condition.type) {
    case 'range':
      return context.range === condition.value;

    case 'bullseye':
      return context.inBullseye === true;

    case 'behind_target':
      // Would need arc checking - simplified
      return false;

    case 'stressed':
      return context.attacker.isStressed;

    case 'damaged':
      return context.attacker.hull < context.attacker.maxHull - condition.threshold;

    case 'outnumbered':
      const allyCount = context.nearbyAllies?.length ?? 0;
      return allyCount === 0;

    case 'near_ally':
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
  abilityIds: string[]
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
    if (!ability || ability.trigger !== 'passive') continue;

    if (id === 'hull_upgrade') {
      hullBonus += 1;
    }
    if (id === 'shield_upgrade') {
      shieldBonus += 1;
    }
    if (id === 'stealth_device' && ship.hull === ship.maxHull) {
      agilityBonus += 1;
    }
  }

  return { hullBonus, shieldBonus, agilityBonus };
}
