/**
 * Combat System
 * Handles dice rolling, attack resolution, and damage application
 * Based on tabletop miniatures combat mechanics
 */

import type { RandomGenerator } from "../utils/random";
import { getDefaultRng } from "../utils/random";
import type { AttackDiceFace, DefenseDiceFace } from "../core/types";
import { clampWithWarning } from "../core/errors";

// ============================================
// Constants for bounds checking
// ============================================

const MAX_DICE_COUNT = 10;
const MIN_DICE_COUNT = 0;
const MAX_SHIELDS = 99;
const MAX_HULL = 99;

// ============================================
// Dice Definitions
// ============================================

/**
 * Attack dice face probabilities (8-sided die)
 * hit: 3/8, critical: 1/8, focus: 2/8, blank: 2/8
 */
export const ATTACK_DICE_FACES: readonly AttackDiceFace[] = [
  "hit",
  "hit",
  "hit",
  "critical",
  "focus",
  "focus",
  "blank",
  "blank",
];

/**
 * Defense dice face probabilities (8-sided die)
 * evade: 3/8, focus: 2/8, blank: 3/8
 */
export const DEFENSE_DICE_FACES: readonly DefenseDiceFace[] = [
  "evade",
  "evade",
  "evade",
  "focus",
  "focus",
  "blank",
  "blank",
  "blank",
];

// ============================================
// Dice Rolling
// ============================================

/**
 * Roll attack dice
 *
 * @param count - Number of dice to roll
 * @param rng - Random generator (optional, uses default if not provided)
 * @returns Array of dice results
 */
export function rollAttackDice(
  count: number,
  rng: RandomGenerator = getDefaultRng(),
): AttackDiceFace[] {
  // Bounds check: clamp dice count to valid range
  const safeCount = clampWithWarning(
    Math.floor(count),
    MIN_DICE_COUNT,
    MAX_DICE_COUNT,
    { valueName: "attackDiceCount" },
  );

  const results: AttackDiceFace[] = [];
  for (let i = 0; i < safeCount; i++) {
    const face = rng.pick(ATTACK_DICE_FACES);
    if (face) results.push(face);
  }
  return results;
}

/**
 * Roll defense dice
 *
 * @param count - Number of dice to roll
 * @param rng - Random generator (optional, uses default if not provided)
 * @returns Array of dice results
 */
export function rollDefenseDice(
  count: number,
  rng: RandomGenerator = getDefaultRng(),
): DefenseDiceFace[] {
  // Bounds check: clamp dice count to valid range
  const safeCount = clampWithWarning(
    Math.floor(count),
    MIN_DICE_COUNT,
    MAX_DICE_COUNT,
    { valueName: "defenseDiceCount" },
  );

  const results: DefenseDiceFace[] = [];
  for (let i = 0; i < safeCount; i++) {
    const face = rng.pick(DEFENSE_DICE_FACES);
    if (face) results.push(face);
  }
  return results;
}

// ============================================
// Dice Modification
// ============================================

/**
 * Convert focus results to hits on attack dice
 */
export function convertAttackFocus(dice: AttackDiceFace[]): AttackDiceFace[] {
  return dice.map((face) => (face === "focus" ? "hit" : face));
}

/**
 * Convert focus results to evades on defense dice
 */
export function convertDefenseFocus(
  dice: DefenseDiceFace[],
): DefenseDiceFace[] {
  return dice.map((face) => (face === "focus" ? "evade" : face));
}

/**
 * Count specific faces in attack dice
 */
export function countAttackFaces(dice: readonly AttackDiceFace[]): {
  hits: number;
  crits: number;
  focus: number;
  blank: number;
} {
  return {
    hits: dice.filter((f) => f === "hit").length,
    crits: dice.filter((f) => f === "critical").length,
    focus: dice.filter((f) => f === "focus").length,
    blank: dice.filter((f) => f === "blank").length,
  };
}

/**
 * Count specific faces in defense dice
 */
export function countDefenseFaces(dice: readonly DefenseDiceFace[]): {
  evades: number;
  focus: number;
  blank: number;
} {
  return {
    evades: dice.filter((f) => f === "evade").length,
    focus: dice.filter((f) => f === "focus").length,
    blank: dice.filter((f) => f === "blank").length,
  };
}

// ============================================
// Attack Resolution
// ============================================

export interface AttackContext {
  // Attacker
  readonly attackDice: number;
  readonly attackerHasFocus: boolean;
  readonly attackerHasTargetLock: boolean;

  // Defender
  readonly defenseDice: number;
  readonly defenderHasFocus: boolean;
  readonly defenderHasEvadeToken: boolean;
  readonly defenderIsReinforced?: boolean;
  readonly defenderShields: number;
  readonly defenderHull: number;
  /** Flat hull-damage reduction per attack (capital ships). Chip damage still gets through. */
  readonly defenderArmor?: number;

  // Range modifiers
  readonly range: 1 | 2 | 3;
}

export interface ResolvedAttack {
  readonly attackRoll: readonly AttackDiceFace[];
  readonly defenseRoll: readonly DefenseDiceFace[];
  readonly modifiedAttack: readonly AttackDiceFace[];
  readonly modifiedDefense: readonly DefenseDiceFace[];
  readonly hitsLanded: number;
  readonly critsLanded: number;
  readonly totalDamage: number;
  readonly shieldDamage: number;
  readonly hullDamage: number;
  readonly shipDestroyed: boolean;
}

/**
 * Resolve a complete attack
 *
 * @param context - Attack context with all relevant stats
 * @param rng - Random generator for deterministic testing
 * @returns Complete attack result
 */
export function resolveAttack(
  context: AttackContext,
  rng: RandomGenerator = getDefaultRng(),
): ResolvedAttack {
  // Calculate dice counts with range modifiers
  let attackDiceCount = context.attackDice;
  let defenseDiceCount = context.defenseDice;

  // Range 1: attacker +1 die
  if (context.range === 1) {
    attackDiceCount += 1;
  }
  // Range 3: defender +1 die
  if (context.range === 3) {
    defenseDiceCount += 1;
  }

  // Roll dice
  const attackRoll = rollAttackDice(attackDiceCount, rng);
  const defenseRoll = rollDefenseDice(defenseDiceCount, rng);

  // Modify attack dice
  let modifiedAttack = [...attackRoll];

  // Target lock allows rerolling blanks (we'll reroll all blanks for simplicity)
  if (context.attackerHasTargetLock) {
    modifiedAttack = modifiedAttack.map((face) =>
      face === "blank" ? (rng.pick(ATTACK_DICE_FACES) ?? "blank") : face,
    );
  }

  // Focus converts focus to hits
  if (context.attackerHasFocus) {
    modifiedAttack = convertAttackFocus(modifiedAttack);
  }

  // Modify defense dice
  let modifiedDefense = [...defenseRoll];

  // Focus converts focus to evades
  if (context.defenderHasFocus) {
    modifiedDefense = convertDefenseFocus(modifiedDefense);
  }

  // Evade token adds one evade result
  if (context.defenderHasEvadeToken) {
    modifiedDefense.push("evade");
  }

  // Reinforce token adds one evade result (bonus defense die)
  if (context.defenderIsReinforced) {
    modifiedDefense.push("evade");
  }

  // Count results
  const attackCounts = countAttackFaces(modifiedAttack);
  const defenseCounts = countDefenseFaces(modifiedDefense);

  // Cancel hits with evades
  // Evades cancel regular hits first, then crits
  let remainingEvades = defenseCounts.evades;
  let hitsLanded = attackCounts.hits;
  let critsLanded = attackCounts.crits;

  // Cancel regular hits first
  const hitsToCancel = Math.min(remainingEvades, hitsLanded);
  hitsLanded -= hitsToCancel;
  remainingEvades -= hitsToCancel;

  // Then cancel crits
  const critsToCancel = Math.min(remainingEvades, critsLanded);
  critsLanded -= critsToCancel;

  // Apply damage
  // Regular hits go to shields first, then hull
  // Crits bypass shields and go directly to hull
  let shieldDamage = 0;
  let hullDamage = 0;

  // Bounds check defender stats
  let remainingShields = clampWithWarning(
    context.defenderShields,
    0,
    MAX_SHIELDS,
    { valueName: "defenderShields" },
  );
  let remainingHull = clampWithWarning(context.defenderHull, 0, MAX_HULL, {
    valueName: "defenderHull",
  });

  // Apply regular hits to shields first
  const hitsToShields = Math.min(hitsLanded, remainingShields);
  shieldDamage += hitsToShields;
  remainingShields -= hitsToShields;
  const hitsToHull = hitsLanded - hitsToShields;
  hullDamage += hitsToHull;
  remainingHull -= hitsToHull;

  // Crits always go to hull
  hullDamage += critsLanded;
  remainingHull -= critsLanded;

  // Armor reduces hull damage per attack but never fully blocks it
  if (hullDamage > 0 && context.defenderArmor) {
    const reduced = Math.max(1, hullDamage - context.defenderArmor);
    remainingHull += hullDamage - reduced;
    hullDamage = reduced;
  }

  // Check destruction
  const shipDestroyed = remainingHull <= 0;

  return {
    attackRoll,
    defenseRoll,
    modifiedAttack,
    modifiedDefense,
    hitsLanded,
    critsLanded,
    totalDamage: hitsLanded + critsLanded,
    shieldDamage,
    hullDamage,
    shipDestroyed,
  };
}

// ============================================
// Combat Utilities
// ============================================

/**
 * Calculate expected damage (for AI evaluation)
 *
 * @param attackDice - Number of attack dice
 * @param defenseDice - Number of defense dice
 * @returns Expected damage (average)
 */
export function calculateExpectedDamage(
  attackDice: number,
  defenseDice: number,
): number {
  // Attack: 3/8 hit + 1/8 crit = 4/8 = 0.5 damage per die
  // Defense: 3/8 evade = 0.375 cancels per die
  const expectedHits = attackDice * 0.5;
  const expectedEvades = defenseDice * 0.375;
  return Math.max(0, expectedHits - expectedEvades);
}

/**
 * Check if an attack is possible (target in range and arc)
 * This is a simplified check - full implementation in TargetingSystem
 */
export function canAttack(range: 1 | 2 | 3 | null, isInArc: boolean): boolean {
  return range !== null && isInArc;
}
