/**
 * Upgrade System
 *
 * Defines upgrade slots, upgrade cards, and the shop system
 * for purchasing upgrades with credits earned in campaign.
 */

import type { FactionId, ShipSize } from '../config';
import type { ShipRole } from '../core/types';

// ============================================
// Upgrade Slot Types
// ============================================

export type UpgradeSlotType =
  | 'talent' // Pilot talents
  | 'missile' // Missiles and rockets
  | 'torpedo' // Torpedoes
  | 'cannon' // Heavy cannons
  | 'turret' // Turret weapons
  | 'bomb' // Bombs and mines
  | 'crew' // Crew members
  | 'gunner' // Dedicated gunners
  | 'astromech' // R2 units, etc.
  | 'sensor' // Targeting systems
  | 'tech' // Advanced technology
  | 'modification' // Ship modifications
  | 'title' // Unique ship titles
  | 'configuration' // Ship configs
  | 'force_power'; // Force abilities (Ascendant Empire)

// ============================================
// Upgrade Definitions
// ============================================

export interface UpgradeDefinition {
  readonly id: string;
  readonly name: string;
  readonly slotType: UpgradeSlotType;
  readonly description: string;

  // Costs
  readonly pointCost: number;
  readonly creditCost: number; // For shop purchase

  // Requirements
  readonly requiredFaction?: FactionId;
  readonly requiredShipSize?: ShipSize | ShipSize[];
  readonly requiredShipRole?: ShipRole | ShipRole[];
  readonly requiredSlots?: UpgradeSlotType[]; // Additional slots consumed
  readonly isUnique?: boolean; // Only one per squad

  // Effects (stat modifiers)
  readonly effects?: UpgradeEffects;
}

export interface UpgradeEffects {
  // Stat bonuses
  readonly hullBonus?: number;
  readonly shieldBonus?: number;
  readonly agilityBonus?: number;
  readonly attackBonus?: number;

  // Action additions
  readonly addsAction?: string;
  readonly addsActionLinked?: { action: string; linkedTo: string };

  // Special modifiers
  readonly rangeBonus?: number;
  readonly rerollCount?: number;
  readonly chargesAdded?: number;
}

// ============================================
// Upgrade Database
// ============================================

export const UPGRADE_DEFINITIONS: Record<string, UpgradeDefinition> = {
  // ============================================
  // MODIFICATIONS
  // ============================================
  engine_upgrade: {
    id: 'engine_upgrade',
    name: 'Engine Upgrade',
    slotType: 'modification',
    description: 'Adds Boost action to your action bar',
    pointCost: 3,
    creditCost: 150,
    requiredShipSize: 'small',
    effects: {
      addsAction: 'boost',
    },
  },

  shield_upgrade: {
    id: 'shield_upgrade',
    name: 'Shield Upgrade',
    slotType: 'modification',
    description: '+1 shield value',
    pointCost: 4,
    creditCost: 200,
    effects: {
      shieldBonus: 1,
    },
  },

  hull_upgrade: {
    id: 'hull_upgrade',
    name: 'Hull Upgrade',
    slotType: 'modification',
    description: '+1 hull value',
    pointCost: 3,
    creditCost: 150,
    effects: {
      hullBonus: 1,
    },
  },

  stealth_device: {
    id: 'stealth_device',
    name: 'Stealth Device',
    slotType: 'modification',
    description: '+1 agility while undamaged',
    pointCost: 6,
    creditCost: 300,
    requiredShipSize: 'small',
    effects: {
      agilityBonus: 1,
    },
  },

  vectored_thrusters: {
    id: 'vectored_thrusters',
    name: 'Vectored Thrusters',
    slotType: 'modification',
    description: 'Adds Barrel Roll action',
    pointCost: 4,
    creditCost: 200,
    requiredShipSize: 'small',
    effects: {
      addsAction: 'barrel_roll',
    },
  },

  // ============================================
  // SENSORS
  // ============================================
  fire_control_system: {
    id: 'fire_control_system',
    name: 'Fire-Control System',
    slotType: 'sensor',
    description: 'After attacking, may acquire lock on defender',
    pointCost: 2,
    creditCost: 100,
  },

  advanced_sensors: {
    id: 'advanced_sensors',
    name: 'Advanced Sensors',
    slotType: 'sensor',
    description: 'Before revealing dial, may perform 1 action',
    pointCost: 3,
    creditCost: 150,
  },

  collision_detector: {
    id: 'collision_detector',
    name: 'Collision Detector',
    slotType: 'sensor',
    description: 'Ignore obstacles when moving and attacking',
    pointCost: 4,
    creditCost: 200,
  },

  // ============================================
  // TECH
  // ============================================
  targeting_computer: {
    id: 'targeting_computer',
    name: 'Targeting Computer',
    slotType: 'tech',
    description: 'Adds Calculate action',
    pointCost: 2,
    creditCost: 100,
    effects: {
      addsAction: 'calculate',
    },
  },

  pattern_analyzer: {
    id: 'pattern_analyzer',
    name: 'Pattern Analyzer',
    slotType: 'tech',
    description: 'After red maneuver, may perform 1 action',
    pointCost: 3,
    creditCost: 150,
  },

  // ============================================
  // CANNONS
  // ============================================
  heavy_laser_cannon: {
    id: 'heavy_laser_cannon',
    name: 'Heavy Laser Cannon',
    slotType: 'cannon',
    description: 'Attack: 4 dice, Range 2-3. Cannot attack at range 1',
    pointCost: 5,
    creditCost: 250,
    effects: {
      attackBonus: 1,
    },
  },

  ion_cannon: {
    id: 'ion_cannon',
    name: 'Ion Cannon',
    slotType: 'cannon',
    description: 'Attack: 3 dice. Hit causes 1 ion token instead of damage',
    pointCost: 4,
    creditCost: 200,
  },

  jamming_beam: {
    id: 'jamming_beam',
    name: 'Jamming Beam',
    slotType: 'cannon',
    description: 'Attack: 1 die. Hit causes 2 jam tokens',
    pointCost: 2,
    creditCost: 100,
  },

  // ============================================
  // CREW
  // ============================================
  veteran_gunner: {
    id: 'veteran_gunner',
    name: 'Veteran Gunner',
    slotType: 'crew',
    description: 'After missing, may perform bonus attack',
    pointCost: 5,
    creditCost: 250,
    requiredShipSize: ['medium', 'large'],
  },

  tactical_officer: {
    id: 'tactical_officer',
    name: 'Tactical Officer',
    slotType: 'crew',
    description: 'Adds Coordinate action linked to Focus',
    pointCost: 4,
    creditCost: 200,
    requiredShipSize: ['medium', 'large'],
    effects: {
      addsActionLinked: { action: 'coordinate', linkedTo: 'focus' },
    },
  },

  weapons_engineer: {
    id: 'weapons_engineer',
    name: 'Weapons Engineer',
    slotType: 'crew',
    description: 'May maintain 2 target locks',
    pointCost: 3,
    creditCost: 150,
    requiredShipSize: ['medium', 'large'],
  },

  // ============================================
  // ASTROMECH
  // ============================================
  targeting_astromech: {
    id: 'targeting_astromech',
    name: 'Targeting Astromech',
    slotType: 'astromech',
    description: 'After executing 3-5 speed maneuver, may acquire lock',
    pointCost: 3,
    creditCost: 150,
    requiredFaction: 'free_confederation',
  },

  repair_astromech: {
    id: 'repair_astromech',
    name: 'Repair Astromech',
    slotType: 'astromech',
    description: 'End of round: if damaged, spend charge to recover 1 shield',
    pointCost: 4,
    creditCost: 200,
    effects: {
      chargesAdded: 2,
    },
  },

  // ============================================
  // TALENTS
  // ============================================
  predator: {
    id: 'predator',
    name: 'Predator',
    slotType: 'talent',
    description: 'When attacking, reroll 1 attack die',
    pointCost: 3,
    creditCost: 150,
    effects: {
      rerollCount: 1,
    },
  },

  elusive: {
    id: 'elusive',
    name: 'Elusive',
    slotType: 'talent',
    description: 'When defending, reroll 1 defense die. Then gain 1 stress',
    pointCost: 3,
    creditCost: 150,
  },

  marksman: {
    id: 'marksman',
    name: 'Marksman',
    slotType: 'talent',
    description: 'When attacking, spend focus to change all focus to hits',
    pointCost: 2,
    creditCost: 100,
  },

  daredevil: {
    id: 'daredevil',
    name: 'Daredevil',
    slotType: 'talent',
    description: 'After red maneuver, may perform bonus attack',
    pointCost: 4,
    creditCost: 200,
    requiredShipSize: 'small',
  },

  expert_handling: {
    id: 'expert_handling',
    name: 'Expert Handling',
    slotType: 'talent',
    description: 'Adds Barrel Roll, then remove 1 target lock',
    pointCost: 2,
    creditCost: 100,
    effects: {
      addsAction: 'barrel_roll',
    },
  },

  phantom_strike: {
    id: 'phantom_strike',
    name: 'Phantom Strike',
    slotType: 'talent',
    description: 'After decloaking, may perform Evade action',
    pointCost: 4,
    creditCost: 200,
  },

  force_sensitive: {
    id: 'force_sensitive',
    name: 'Force Sensitive',
    slotType: 'talent',
    description: 'Gain 1 Force charge. May spend to change 1 focus result',
    pointCost: 5,
    creditCost: 300,
    effects: {
      chargesAdded: 1,
    },
  },

  precognition: {
    id: 'precognition',
    name: 'Precognition',
    slotType: 'talent',
    description: 'Spend Force to reroll any number of defense dice',
    pointCost: 4,
    creditCost: 200,
  },

  coordinated_assault: {
    id: 'coordinated_assault',
    name: 'Coordinated Assault',
    slotType: 'talent',
    description: 'Friendly ships at range 0-2 may reroll 1 attack die',
    pointCost: 5,
    creditCost: 250,
    requiredShipSize: ['medium', 'large'],
  },

  squadron_leader: {
    id: 'squadron_leader',
    name: 'Squadron Leader',
    slotType: 'talent',
    description: 'Before engaging, choose friendly ship to gain focus token',
    pointCost: 4,
    creditCost: 200,
  },

  bombardier: {
    id: 'bombardier',
    name: 'Bombardier',
    slotType: 'talent',
    description: 'When dropping bombs, may use speed 2 template',
    pointCost: 3,
    creditCost: 150,
    requiredShipRole: 'bomber',
  },

  // ============================================
  // MISSILES
  // ============================================
  concussion_missile: {
    id: 'concussion_missile',
    name: 'Concussion Missiles',
    slotType: 'missile',
    description: 'Attack: 3 dice, Range 2-3. Spend target lock. Defender cannot use Calculate',
    pointCost: 4,
    creditCost: 200,
    effects: {
      chargesAdded: 3,
    },
  },

  seeker_missile: {
    id: 'seeker_missile',
    name: 'Seeker Missiles',
    slotType: 'missile',
    description: 'Attack: 3 dice, Range 2-4. Spend target lock. +1 die at range 2',
    pointCost: 3,
    creditCost: 150,
    effects: {
      chargesAdded: 2,
    },
  },

  // ============================================
  // TORPEDOES
  // ============================================
  proton_torpedo: {
    id: 'proton_torpedo',
    name: 'Proton Torpedoes',
    slotType: 'torpedo',
    description: 'Attack: 4 dice, Range 2-3. Spend lock. Change 1 hit to crit',
    pointCost: 5,
    creditCost: 250,
    effects: {
      chargesAdded: 2,
    },
  },

  ion_torpedo: {
    id: 'ion_torpedo',
    name: 'Ion Torpedoes',
    slotType: 'torpedo',
    description: 'Attack: 4 dice, Range 2-3. Hits cause ion tokens instead of damage',
    pointCost: 5,
    creditCost: 250,
    effects: {
      chargesAdded: 2,
    },
  },

  // ============================================
  // BOMBS
  // ============================================
  proton_bomb: {
    id: 'proton_bomb',
    name: 'Proton Bombs',
    slotType: 'bomb',
    description: 'Drop device. At activation, ships at range 0-1 suffer 1 crit',
    pointCost: 5,
    creditCost: 250,
    effects: {
      chargesAdded: 2,
    },
  },

  cluster_mine: {
    id: 'cluster_mine',
    name: 'Cluster Mines',
    slotType: 'bomb',
    description: 'Drop 3 mine devices in a row. Each deals 2 damage when triggered',
    pointCost: 4,
    creditCost: 200,
    effects: {
      chargesAdded: 1,
    },
  },

  proximity_mine: {
    id: 'proximity_mine',
    name: 'Proximity Mines',
    slotType: 'bomb',
    description: 'Drop device. When ship approaches, roll 2 attack dice',
    pointCost: 3,
    creditCost: 150,
    effects: {
      chargesAdded: 2,
    },
  },

  // ============================================
  // TURRETS
  // ============================================
  light_laser_turret: {
    id: 'light_laser_turret',
    name: 'Light Laser Turret',
    slotType: 'turret',
    description: 'Attack: 2 dice, Range 1-2. Rotate arc indicator',
    pointCost: 2,
    creditCost: 100,
  },

  twin_laser_turret: {
    id: 'twin_laser_turret',
    name: 'Twin Laser Turret',
    slotType: 'turret',
    description: 'Attack: 3 dice, Range 2-3. Two attacks, each hit is 1 damage max',
    pointCost: 4,
    creditCost: 200,
  },

  ion_turret: {
    id: 'ion_turret',
    name: 'Ion Cannon Turret',
    slotType: 'turret',
    description: 'Attack: 3 dice, Range 1-2. Hits cause ion tokens',
    pointCost: 4,
    creditCost: 200,
  },

  quad_laser_turret: {
    id: 'quad_laser_turret',
    name: 'Quad Laser Cannon',
    slotType: 'turret',
    description: 'Attack: 4 dice, Range 1-2. Mobile arc turret',
    pointCost: 6,
    creditCost: 300,
    requiredShipSize: ['medium', 'large'],
  },

  // ============================================
  // GUNNER
  // ============================================
  skilled_gunner: {
    id: 'skilled_gunner',
    name: 'Skilled Gunner',
    slotType: 'gunner',
    description: 'After attacking, may spend focus for bonus attack on different target',
    pointCost: 3,
    creditCost: 150,
    requiredShipSize: ['medium', 'large'],
  },

  // ============================================
  // CONFIGURATION
  // ============================================
  combat_configuration: {
    id: 'combat_configuration',
    name: 'Combat Configuration',
    slotType: 'configuration',
    description: '+1 attack at range 1. Reduce agility by 1',
    pointCost: 2,
    creditCost: 100,
    effects: {
      attackBonus: 1,
      agilityBonus: -1,
    },
  },

  evasion_configuration: {
    id: 'evasion_configuration',
    name: 'Evasion Configuration',
    slotType: 'configuration',
    description: '+1 agility. May not perform Coordinate action',
    pointCost: 2,
    creditCost: 100,
    effects: {
      agilityBonus: 1,
    },
  },

  // ============================================
  // TITLES (Unique)
  // ============================================
  ace_pilot_title: {
    id: 'ace_pilot_title',
    name: 'Ace Pilot',
    slotType: 'title',
    description: '+1 pilot skill. Reroll 1 attack die',
    pointCost: 3,
    creditCost: 200,
    isUnique: true,
    effects: {
      rerollCount: 1,
    },
  },
};

// ============================================
// Upgrade Slot Configuration per Ship
// ============================================

export interface ShipUpgradeSlots {
  readonly shipId: string;
  readonly slots: UpgradeSlotType[];
}

/**
 * Default upgrade slots by ship size and role
 */
export function getDefaultUpgradeSlots(
  size: ShipSize,
  role: ShipRole
): UpgradeSlotType[] {
  const slots: UpgradeSlotType[] = ['modification'];

  // All ships get talent slot
  slots.push('talent');

  // Size-based slots
  switch (size) {
    case 'tiny':
      if (role === 'interceptor' || role === 'light_fighter') {
        slots.push('missile');
      }
      break;

    case 'small':
      slots.push('sensor');
      if (role === 'interceptor' || role === 'light_fighter') {
        slots.push('missile');
      }
      if (role === 'bomber') {
        slots.push('torpedo', 'bomb');
      }
      break;

    case 'medium':
      slots.push('sensor', 'crew', 'gunner');
      if (role === 'gunship' || role === 'heavy_fighter') {
        slots.push('cannon', 'turret');
      }
      if (role === 'bomber') {
        slots.push('torpedo', 'bomb', 'missile');
      }
      break;

    case 'large':
      slots.push('sensor', 'crew', 'crew', 'gunner', 'tech');
      slots.push('cannon', 'turret', 'missile', 'torpedo');
      if (role === 'capital') {
        slots.push('bomb', 'configuration');
      }
      break;

    case 'huge':
      slots.push('sensor', 'crew', 'crew', 'crew', 'gunner', 'gunner', 'tech', 'tech');
      slots.push('cannon', 'cannon', 'turret', 'turret', 'missile', 'torpedo', 'bomb');
      if (role === 'capital') {
        slots.push('configuration', 'configuration');
      }
      break;
  }

  return slots;
}

// ============================================
// Shop System
// ============================================

export interface ShopState {
  readonly availableUpgrades: string[]; // IDs of upgrades in stock
  readonly purchasedUpgrades: string[]; // IDs of upgrades owned
  readonly playerCredits: number;
}

/**
 * Get upgrades available in shop for a faction
 */
export function getShopInventory(faction: FactionId): UpgradeDefinition[] {
  return Object.values(UPGRADE_DEFINITIONS).filter((upgrade) => {
    // No faction requirement or matches faction
    if (upgrade.requiredFaction && upgrade.requiredFaction !== faction) {
      return false;
    }
    return true;
  });
}

/**
 * Check if player can afford an upgrade
 */
export function canAffordUpgrade(
  upgrade: UpgradeDefinition,
  credits: number
): boolean {
  return credits >= upgrade.creditCost;
}

/**
 * Purchase an upgrade
 */
export function purchaseUpgrade(
  state: ShopState,
  upgradeId: string
): ShopState | null {
  const upgrade = UPGRADE_DEFINITIONS[upgradeId];
  if (!upgrade) return null;

  if (state.playerCredits < upgrade.creditCost) {
    return null; // Can't afford
  }

  if (state.purchasedUpgrades.includes(upgradeId)) {
    return null; // Already owned
  }

  return {
    ...state,
    purchasedUpgrades: [...state.purchasedUpgrades, upgradeId],
    playerCredits: state.playerCredits - upgrade.creditCost,
  };
}

/**
 * Check if an upgrade can be equipped on a ship
 */
export function canEquipUpgrade(
  upgrade: UpgradeDefinition,
  ship: {
    size: ShipSize;
    role: ShipRole;
    faction: FactionId;
    availableSlots: UpgradeSlotType[];
    equippedUpgrades: string[];
  }
): { valid: boolean; reason?: string } {
  // Check slot availability
  if (!ship.availableSlots.includes(upgrade.slotType)) {
    return { valid: false, reason: `No ${upgrade.slotType} slot available` };
  }

  // Check faction requirement
  if (upgrade.requiredFaction && upgrade.requiredFaction !== ship.faction) {
    return { valid: false, reason: `Requires ${upgrade.requiredFaction}` };
  }

  // Check size requirement
  if (upgrade.requiredShipSize) {
    const sizes = Array.isArray(upgrade.requiredShipSize)
      ? upgrade.requiredShipSize
      : [upgrade.requiredShipSize];
    if (!sizes.includes(ship.size)) {
      return { valid: false, reason: `Requires ${sizes.join(' or ')} ship` };
    }
  }

  // Check role requirement
  if (upgrade.requiredShipRole) {
    const roles = Array.isArray(upgrade.requiredShipRole)
      ? upgrade.requiredShipRole
      : [upgrade.requiredShipRole];
    if (!roles.includes(ship.role)) {
      return { valid: false, reason: `Requires ${roles.join(' or ')} role` };
    }
  }

  // Check uniqueness
  if (upgrade.isUnique && ship.equippedUpgrades.includes(upgrade.id)) {
    return { valid: false, reason: 'Already equipped (unique)' };
  }

  return { valid: true };
}

/**
 * Calculate total point cost of equipped upgrades
 */
export function calculateUpgradesCost(upgradeIds: string[]): number {
  return upgradeIds.reduce((total, id) => {
    const upgrade = UPGRADE_DEFINITIONS[id];
    return total + (upgrade?.pointCost ?? 0);
  }, 0);
}
