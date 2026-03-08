/**
 * Faction Abilities System
 *
 * Each faction has unique passive abilities that affect gameplay:
 * - Terran Hegemony: Formation Bonus (+1 attack when near allies)
 * - Free Confederation: Hit and Run (boost after attacking)
 * - Synthetic Collective: Networked Targeting (shared target locks)
 * - Void Corsairs: Intimidation (damaged enemies have reduced agility)
 * - Ascendant Empire: Prescience (reroll one die per attack)
 */

import type { FactionId } from '../config';

export interface FactionAbility {
  id: string;
  name: string;
  description: string;
  faction: FactionId;
  /** Effect type for UI display */
  effectType: 'attack' | 'defense' | 'movement' | 'support';
}

export const FACTION_ABILITIES: Record<FactionId, FactionAbility> = {
  terran_hegemony: {
    id: 'formation_bonus',
    name: 'Formation Tactics',
    description: '+1 attack dice when within 150px of an ally',
    faction: 'terran_hegemony',
    effectType: 'attack',
  },
  free_confederation: {
    id: 'hit_and_run',
    name: 'Hit and Run',
    description: 'Can boost after dealing damage',
    faction: 'free_confederation',
    effectType: 'movement',
  },
  synthetic_collective: {
    id: 'networked_targeting',
    name: 'Networked Targeting',
    description: 'All ships share target lock data (+10% hit chance vs locked targets)',
    faction: 'synthetic_collective',
    effectType: 'attack',
  },
  void_corsairs: {
    id: 'intimidation',
    name: 'Intimidation',
    description: 'Enemies at <50% hull have -1 agility',
    faction: 'void_corsairs',
    effectType: 'attack',
  },
  ascendant_empire: {
    id: 'prescience',
    name: 'Prescience',
    description: '+5% hit chance from precognitive abilities',
    faction: 'ascendant_empire',
    effectType: 'attack',
  },
};

/**
 * Check if attacker gets formation bonus (Terran Hegemony)
 */
export function hasFormationBonus(
  attackerX: number,
  attackerY: number,
  attackerFaction: FactionId,
  allies: Array<{ x: number; y: number; faction: FactionId; hull: number }>
): boolean {
  if (attackerFaction !== 'terran_hegemony') return false;

  const formationRange = 150;
  return allies.some((ally) => {
    if (ally.faction !== attackerFaction || ally.hull <= 0) return false;
    const dist = Math.sqrt(
      Math.pow(attackerX - ally.x, 2) + Math.pow(attackerY - ally.y, 2)
    );
    return dist <= formationRange;
  });
}

/**
 * Check if attacker can boost after attack (Free Confederation)
 */
export function canHitAndRun(attackerFaction: FactionId, hitLanded: boolean): boolean {
  return attackerFaction === 'free_confederation' && hitLanded;
}

/**
 * Check if target has shared target lock (Synthetic Collective)
 */
export function hasNetworkedTargeting(
  attackerFaction: FactionId,
  targetId: string,
  allAllies: Array<{ faction: FactionId; hasTargetLock: string | null; hull: number }>
): boolean {
  if (attackerFaction !== 'synthetic_collective') return false;

  return allAllies.some(
    (ally) =>
      ally.faction === attackerFaction &&
      ally.hull > 0 &&
      ally.hasTargetLock === targetId
  );
}

/**
 * Get intimidation agility penalty (Void Corsairs)
 */
export function getIntimidationPenalty(
  attackerFaction: FactionId,
  targetHull: number,
  targetMaxHull: number
): number {
  if (attackerFaction !== 'void_corsairs') return 0;

  // Target at less than 50% hull is intimidated
  if (targetHull / targetMaxHull < 0.5) {
    return 1; // -1 agility
  }
  return 0;
}

/**
 * Get prescience hit bonus (Ascendant Empire)
 */
export function getPrescienceBonus(attackerFaction: FactionId): number {
  if (attackerFaction !== 'ascendant_empire') return 0;
  return 0.05; // +5% hit chance
}

/**
 * Calculate all faction ability modifiers for an attack
 */
export interface FactionCombatModifiers {
  attackDiceBonus: number;
  hitChanceBonus: number;
  defenseReduction: number;
  canBoostAfter: boolean;
}

export function calculateFactionModifiers(
  attackerFaction: FactionId,
  attackerX: number,
  attackerY: number,
  targetFaction: FactionId,
  targetId: string,
  targetHull: number,
  targetMaxHull: number,
  allies: Array<{ x: number; y: number; faction: FactionId; hull: number; hasTargetLock: string | null }>,
  hitLanded: boolean
): FactionCombatModifiers {
  let attackDiceBonus = 0;
  let hitChanceBonus = 0;
  let defenseReduction = 0;
  let canBoostAfter = false;

  // Terran Hegemony: Formation Tactics
  if (hasFormationBonus(attackerX, attackerY, attackerFaction, allies)) {
    attackDiceBonus += 1;
  }

  // Synthetic Collective: Networked Targeting
  if (hasNetworkedTargeting(attackerFaction, targetId, allies)) {
    hitChanceBonus += 0.1;
  }

  // Ascendant Empire: Prescience
  hitChanceBonus += getPrescienceBonus(attackerFaction);

  // Void Corsairs: Intimidation
  defenseReduction += getIntimidationPenalty(attackerFaction, targetHull, targetMaxHull);

  // Free Confederation: Hit and Run
  canBoostAfter = canHitAndRun(attackerFaction, hitLanded);

  return {
    attackDiceBonus,
    hitChanceBonus,
    defenseReduction,
    canBoostAfter,
  };
}
