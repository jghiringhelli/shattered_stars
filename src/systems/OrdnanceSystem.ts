/**
 * Ordnance System
 *
 * Handles special weapons: missiles, torpedoes, bombs, and mines.
 * Each has unique targeting, damage, and behavior characteristics.
 */

import type { ShipState } from '../core/types';
import type { RandomGenerator } from '../utils/random';
import { getDefaultRng } from '../utils/random';
import { distance } from './MovementSystem';

// ============================================
// Ordnance Types
// ============================================

export type OrdnanceType = 'missile' | 'torpedo' | 'bomb' | 'mine' | 'rocket';

export type OrdnanceEffect =
  | 'damage' // Standard damage
  | 'ion' // Disables systems (adds stress, removes tokens)
  | 'tractor' // Moves target toward/away
  | 'cluster' // Multiple hits in area
  | 'seismic' // Destroys obstacles
  | 'emp'; // Disables shields

export interface OrdnanceDefinition {
  readonly id: string;
  readonly name: string;
  readonly type: OrdnanceType;
  readonly effect: OrdnanceEffect;

  // Combat stats
  readonly attackDice: number;
  readonly range: { min: number; max: number }; // Range bands (1-3)
  readonly charges: number;
  readonly recoverable: boolean; // Can be reloaded?

  // Requirements
  readonly requiresTargetLock: boolean;
  readonly requiresFrontArc: boolean;
  readonly requiresBullseye: boolean;

  // Special properties
  readonly areaRadius?: number; // For bombs/cluster
  readonly bonusDamage?: number; // Extra damage on hit
  readonly ionTokens?: number; // Ion tokens applied
  readonly tractorValue?: number; // Tractor beam strength
  readonly convertHitToCrit?: boolean; // Change 1 hit to a crit on hit

  // Point cost for squad building
  readonly pointCost: number;

  // Description for UI
  readonly description: string;
}

// ============================================
// Ordnance Definitions
// ============================================

export const ORDNANCE_DEFINITIONS: Record<string, OrdnanceDefinition> = {
  // MISSILES - Medium range, target lock required
  concussion_missile: {
    id: 'concussion_missile',
    name: 'Burst Missiles',
    type: 'missile',
    effect: 'damage',
    attackDice: 3,
    range: { min: 2, max: 3 },
    charges: 2,
    recoverable: false,
    requiresTargetLock: true,
    requiresFrontArc: true,
    requiresBullseye: false,
    bonusDamage: 1,
    pointCost: 6,
    description: 'After hitting, deal 1 bonus damage',
  },

  cluster_missiles: {
    id: 'cluster_missiles',
    name: 'Cluster Missiles',
    type: 'missile',
    effect: 'cluster',
    attackDice: 3,
    range: { min: 1, max: 2 },
    charges: 4,
    recoverable: false,
    requiresTargetLock: true,
    requiresFrontArc: true,
    requiresBullseye: false,
    areaRadius: 50,
    pointCost: 5,
    description: 'Attack all enemies within range 1 of target',
  },

  homing_missiles: {
    id: 'homing_missiles',
    name: 'Homing Missiles',
    type: 'missile',
    effect: 'damage',
    attackDice: 4,
    range: { min: 2, max: 3 },
    charges: 2,
    recoverable: false,
    requiresTargetLock: true,
    requiresFrontArc: false, // Can fire from any arc!
    requiresBullseye: false,
    pointCost: 8,
    description: 'May attack targets outside your firing arc',
  },

  ion_missiles: {
    id: 'ion_missiles',
    name: 'Ion Missiles',
    type: 'missile',
    effect: 'ion',
    attackDice: 3,
    range: { min: 2, max: 3 },
    charges: 3,
    recoverable: false,
    requiresTargetLock: true,
    requiresFrontArc: true,
    requiresBullseye: false,
    ionTokens: 2,
    pointCost: 4,
    description: 'Apply 2 ion tokens on hit',
  },

  // TORPEDOES - Long range, high damage
  proton_torpedoes: {
    id: 'proton_torpedoes',
    name: 'Fusion Torpedoes',
    type: 'torpedo',
    effect: 'damage',
    attackDice: 4,
    range: { min: 2, max: 3 },
    charges: 2,
    recoverable: false,
    requiresTargetLock: true,
    requiresFrontArc: true,
    requiresBullseye: false,
    bonusDamage: 1,
    convertHitToCrit: true,
    pointCost: 9,
    description: 'Change 1 hit to a crit. Deal 1 bonus damage',
  },

  plasma_torpedoes: {
    id: 'plasma_torpedoes',
    name: 'Plasma Torpedoes',
    type: 'torpedo',
    effect: 'damage',
    attackDice: 3,
    range: { min: 2, max: 3 },
    charges: 2,
    recoverable: false,
    requiresTargetLock: true,
    requiresFrontArc: true,
    requiresBullseye: false,
    pointCost: 7,
    description: 'Before dealing damage, remove 1 shield from defender',
  },

  advanced_torpedoes: {
    id: 'advanced_torpedoes',
    name: 'Advanced Torpedoes',
    type: 'torpedo',
    effect: 'damage',
    attackDice: 5,
    range: { min: 1, max: 3 },
    charges: 1,
    recoverable: true, // Can reload!
    requiresTargetLock: true,
    requiresFrontArc: true,
    requiresBullseye: true, // Must be in bullseye
    bonusDamage: 2,
    pointCost: 12,
    description: 'Bullseye only. Recoverable. +2 bonus damage',
  },

  // BOMBS - Dropped behind ship, area damage
  proton_bombs: {
    id: 'proton_bombs',
    name: 'Fusion Bombs',
    type: 'bomb',
    effect: 'damage',
    attackDice: 0, // Direct damage, no dice
    range: { min: 0, max: 0 },
    charges: 2,
    recoverable: false,
    requiresTargetLock: false,
    requiresFrontArc: false,
    requiresBullseye: false,
    areaRadius: 80,
    bonusDamage: 2, // Flat damage
    pointCost: 5,
    description: 'Drop behind ship. Ships in range take 2 damage',
  },

  seismic_charges: {
    id: 'seismic_charges',
    name: 'Quake Charges',
    type: 'bomb',
    effect: 'seismic',
    attackDice: 0,
    range: { min: 0, max: 0 },
    charges: 2,
    recoverable: false,
    requiresTargetLock: false,
    requiresFrontArc: false,
    requiresBullseye: false,
    areaRadius: 100,
    bonusDamage: 1,
    pointCost: 4,
    description: 'Destroys obstacles and deals 1 damage to nearby ships',
  },

  ion_bombs: {
    id: 'ion_bombs',
    name: 'Ion Bombs',
    type: 'bomb',
    effect: 'ion',
    attackDice: 0,
    range: { min: 0, max: 0 },
    charges: 2,
    recoverable: false,
    requiresTargetLock: false,
    requiresFrontArc: false,
    requiresBullseye: false,
    areaRadius: 80,
    ionTokens: 3,
    pointCost: 4,
    description: 'Ships in range receive 3 ion tokens',
  },

  cluster_mines: {
    id: 'cluster_mines',
    name: 'Cluster Mines',
    type: 'mine',
    effect: 'cluster',
    attackDice: 2,
    range: { min: 0, max: 0 },
    charges: 1,
    recoverable: false,
    requiresTargetLock: false,
    requiresFrontArc: false,
    requiresBullseye: false,
    areaRadius: 60,
    pointCost: 6,
    description: 'Deploy 3 mines. Roll 2 dice for each mine triggered',
  },

  // ROCKETS - Short range, no lock needed
  adv_rockets: {
    id: 'adv_rockets',
    name: 'Advanced Rockets',
    type: 'rocket',
    effect: 'damage',
    attackDice: 3,
    range: { min: 1, max: 2 },
    charges: 1,
    recoverable: true,
    requiresTargetLock: false, // No lock needed!
    requiresFrontArc: true,
    requiresBullseye: false,
    pointCost: 4,
    description: 'No target lock required. Recoverable',
  },

  ion_rockets: {
    id: 'ion_rockets',
    name: 'Ion Rockets',
    type: 'rocket',
    effect: 'ion',
    attackDice: 2,
    range: { min: 1, max: 2 },
    charges: 2,
    recoverable: false,
    requiresTargetLock: false,
    requiresFrontArc: true,
    requiresBullseye: false,
    ionTokens: 2,
    pointCost: 3,
    description: 'Apply 2 ion tokens. No target lock required',
  },
};

// ============================================
// Ordnance State (on a ship)
// ============================================

export interface OrdnanceSlot {
  readonly definitionId: string;
  charges: number;
  isDisabled: boolean;
}

// ============================================
// Bomb/Mine State (on the battlefield)
// ============================================

export interface DeployedOrdnance {
  readonly id: string;
  readonly definitionId: string;
  readonly ownerId: string; // Ship that deployed it
  readonly ownerFaction: string;
  x: number;
  y: number;
  radius: number;
  turnsRemaining: number; // -1 for permanent (mines)
  isTriggered: boolean;
}

// ============================================
// Attack Results
// ============================================

export interface OrdnanceAttackResult {
  readonly success: boolean;
  readonly ordnanceId: string;
  readonly targetId: string;
  readonly attackDice: number;
  readonly hits: number;
  readonly crits: number;
  readonly bonusDamage: number;
  readonly ionTokens: number;
  readonly message: string;
}

export interface BombDetonationResult {
  readonly bombId: string;
  readonly affectedShips: Array<{
    shipId: string;
    damage: number;
    ionTokens: number;
  }>;
  readonly destroyedObstacles: string[];
}

// ============================================
// Ordnance Functions
// ============================================

/**
 * Check if ordnance can be fired at a target
 */
export function canFireOrdnance(
  attacker: ShipState,
  target: ShipState,
  ordnance: OrdnanceDefinition,
  slot: OrdnanceSlot,
  isInFrontArc: boolean,
  isInBullseye: boolean,
  rangeBand: number | null
): { valid: boolean; reason?: string } {
  // Check charges
  if (slot.charges <= 0) {
    return { valid: false, reason: 'No charges remaining' };
  }

  // Check if disabled
  if (slot.isDisabled) {
    return { valid: false, reason: 'Ordnance is disabled' };
  }

  // Check range
  if (rangeBand === null) {
    return { valid: false, reason: 'Target out of range' };
  }
  if (rangeBand < ordnance.range.min || rangeBand > ordnance.range.max) {
    return { valid: false, reason: `Target must be at range ${ordnance.range.min}-${ordnance.range.max}` };
  }

  // Check target lock requirement
  if (ordnance.requiresTargetLock && attacker.hasTargetLock !== target.id) {
    return { valid: false, reason: 'Requires target lock on defender' };
  }

  // Check arc requirements
  if (ordnance.requiresFrontArc && !isInFrontArc) {
    return { valid: false, reason: 'Target must be in front arc' };
  }
  if (ordnance.requiresBullseye && !isInBullseye) {
    return { valid: false, reason: 'Target must be in bullseye arc' };
  }

  return { valid: true };
}

/**
 * Fire ordnance at a target
 */
export function fireOrdnance(
  attacker: ShipState,
  target: ShipState,
  ordnance: OrdnanceDefinition,
  rng: RandomGenerator = getDefaultRng()
): OrdnanceAttackResult {
  // Roll attack dice
  const attackDice = ordnance.attackDice;
  let hits = 0;
  let crits = 0;

  for (let i = 0; i < attackDice; i++) {
    const roll = rng.next();
    if (roll < 0.125) {
      crits++; // 1/8 crit
    } else if (roll < 0.5) {
      hits++; // 3/8 hit
    }
    // else focus (2/8) or blank (2/8)
  }

  // If ordnance converts hits to crits, change 1 hit to a crit
  if (ordnance.convertHitToCrit && hits > 0) {
    hits--;
    crits++;
  }

  const totalHits = hits + crits;
  const bonusDamage = totalHits > 0 ? (ordnance.bonusDamage ?? 0) : 0;
  const ionTokens = totalHits > 0 ? (ordnance.ionTokens ?? 0) : 0;

  return {
    success: totalHits > 0,
    ordnanceId: ordnance.id,
    targetId: target.id,
    attackDice,
    hits,
    crits,
    bonusDamage,
    ionTokens,
    message: totalHits > 0
      ? `${ordnance.name} hit! ${hits} hits, ${crits} crits` + (bonusDamage > 0 ? ` +${bonusDamage} bonus` : '')
      : `${ordnance.name} missed!`,
  };
}

/**
 * Deploy a bomb or mine behind a ship
 */
export function deployBomb(
  ship: ShipState,
  ordnance: OrdnanceDefinition,
  deployDistance: number = 60
): DeployedOrdnance {
  // Calculate position behind ship
  const angleRad = ((ship.angle + 180) * Math.PI) / 180;
  const x = ship.x + Math.sin(angleRad) * deployDistance;
  const y = ship.y - Math.cos(angleRad) * deployDistance;

  return {
    id: `bomb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    definitionId: ordnance.id,
    ownerId: ship.id,
    ownerFaction: ship.faction,
    x,
    y,
    radius: ordnance.areaRadius ?? 50,
    turnsRemaining: ordnance.type === 'mine' ? -1 : 1, // Mines persist, bombs detonate next turn
    isTriggered: false,
  };
}

/**
 * Check if a ship triggers a deployed bomb/mine
 */
export function checkBombTrigger(
  bomb: DeployedOrdnance,
  ship: ShipState
): boolean {
  // Don't trigger on owner
  if (bomb.ownerId === ship.id) return false;

  // Don't trigger on same faction (for now)
  if (bomb.ownerFaction === ship.faction) return false;

  // Check distance
  const dist = distance(bomb.x, bomb.y, ship.x, ship.y);
  return dist <= bomb.radius;
}

/**
 * Detonate a bomb
 */
export function detonateBomb(
  bomb: DeployedOrdnance,
  ordnance: OrdnanceDefinition,
  nearbyShips: readonly ShipState[],
  obstacles: readonly { id: string; x: number; y: number; radius: number }[],
  rng: RandomGenerator = getDefaultRng()
): BombDetonationResult {
  const affectedShips: Array<{ shipId: string; damage: number; ionTokens: number }> = [];
  const destroyedObstacles: string[] = [];

  // Find ships in radius
  for (const ship of nearbyShips) {
    // Don't damage owner (optional - some bombs do)
    if (ship.id === bomb.ownerId) continue;

    const dist = distance(bomb.x, bomb.y, ship.x, ship.y);
    if (dist <= bomb.radius) {
      let damage = 0;
      let ionTokens = 0;

      if (ordnance.effect === 'damage' || ordnance.effect === 'seismic') {
        damage = ordnance.bonusDamage ?? 0;
      } else if (ordnance.effect === 'cluster') {
        // Roll dice for cluster
        for (let i = 0; i < ordnance.attackDice; i++) {
          if (rng.next() < 0.5) damage++; // 50% hit rate for bombs
        }
      }

      if (ordnance.effect === 'ion') {
        ionTokens = ordnance.ionTokens ?? 0;
      }

      if (damage > 0 || ionTokens > 0) {
        affectedShips.push({ shipId: ship.id, damage, ionTokens });
      }
    }
  }

  // Quake charges destroy obstacles
  if (ordnance.effect === 'seismic') {
    for (const obstacle of obstacles) {
      const dist = distance(bomb.x, bomb.y, obstacle.x, obstacle.y);
      if (dist <= bomb.radius + obstacle.radius) {
        destroyedObstacles.push(obstacle.id);
      }
    }
  }

  return {
    bombId: bomb.id,
    affectedShips,
    destroyedObstacles,
  };
}

/**
 * Get all ordnance that a ship type can equip
 */
export function getEquippableOrdnance(
  shipSize: 'small' | 'medium' | 'large',
  hasMissileSlot: boolean,
  hasTorpedoSlot: boolean,
  hasBombSlot: boolean
): OrdnanceDefinition[] {
  const equippable: OrdnanceDefinition[] = [];

  for (const ordnance of Object.values(ORDNANCE_DEFINITIONS)) {
    // Missiles
    if ((ordnance.type === 'missile' || ordnance.type === 'rocket') && hasMissileSlot) {
      equippable.push(ordnance);
    }

    // Torpedoes
    if (ordnance.type === 'torpedo' && hasTorpedoSlot) {
      equippable.push(ordnance);
    }

    // Bombs/Mines (medium and large ships only)
    if ((ordnance.type === 'bomb' || ordnance.type === 'mine') && hasBombSlot) {
      if (shipSize !== 'small') {
        equippable.push(ordnance);
      }
    }
  }

  return equippable;
}

/**
 * Spend a charge from an ordnance slot
 */
export function spendOrdnanceCharge(slot: OrdnanceSlot): OrdnanceSlot {
  return {
    ...slot,
    charges: Math.max(0, slot.charges - 1),
  };
}

/**
 * Reload an ordnance slot (if recoverable)
 */
export function reloadOrdnance(
  slot: OrdnanceSlot,
  ordnance: OrdnanceDefinition
): OrdnanceSlot {
  if (!ordnance.recoverable) {
    return slot;
  }

  return {
    ...slot,
    charges: Math.min(slot.charges + 1, ordnance.charges),
  };
}

/**
 * Create a cluster attack (hit multiple targets near primary)
 */
export function getClusterTargets(
  primaryTarget: ShipState,
  allEnemies: readonly ShipState[],
  clusterRadius: number
): ShipState[] {
  return allEnemies.filter((enemy) => {
    if (enemy.id === primaryTarget.id) return false;
    if (enemy.hull <= 0) return false;

    const dist = distance(primaryTarget.x, primaryTarget.y, enemy.x, enemy.y);
    return dist <= clusterRadius;
  });
}
