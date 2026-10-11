/**
 * EpicRaidCombat — how a quick build acts against (and under) the Boss Raid
 * capital ship, which is a static multi-section hulk rather than a flying
 * equipped ship: the attacker's laser bonuses against the boss's armor, and
 * the player's damage mitigation against boss abilities.
 *
 * Pure: the caller rolls and applies the result.
 */

import type { ShipPose } from "../../core/ArcadeControls";
import {
  laserDamageWithModifiers,
  type CombatModifiers,
} from "../../core/CombatModifiers";
import { laserHitBonus, type AbilityCombatant } from "../PilotAbilityCombat";
import { incomingDamageMultiplier } from "../ShotConditions";

/** The boss as a laser target: its pose and what blunts a bolt. */
export interface BossTarget extends ShipPose {
  readonly shields: number;
  /** Flat damage reduction applied to every hit. */
  readonly armor: number;
}

/** One bolt fired at the boss. */
export interface BossShotInput {
  readonly attacker: AbilityCombatant;
  readonly boss: BossTarget;
  /** Hit probability from the mode's dice model. */
  readonly hitChance: number;
  /** Damage before equipment and armor (the mode's dice damage). */
  readonly baseDamage: number;
  readonly attackerHasWingman: boolean;
  /** Scene time (ms), for the kill-frenzy window. */
  readonly nowMs: number;
  /** Uniform roll in [0, 1): the bolt hits when roll < hitChance. */
  readonly roll: number;
}

/** Every bolt that hits the boss deals at least this much. */
export const MIN_BOSS_HIT_DAMAGE = 1;

/**
 * Damage a bolt deals to the boss: the attacker's laser bonuses (flat, calm,
 * vs-unshielded and the pilot's conditional bonus judged against the boss's
 * pose), then the boss's armor.
 *
 * @param input - Attacker, boss, dice odds and damage, context and roll.
 * @returns Damage to apply (shields first, then a section); 0 on a miss.
 */
export function resolveBossShot(input: BossShotInput): number {
  if (input.roll >= input.hitChance) return 0;
  const { attacker, boss } = input;
  const { modifiers } = attacker;
  const exposed = boss.shields <= 0 ? modifiers.bonusDamageVsUnshielded : 0;
  const raw =
    laserDamageWithModifiers(
      input.baseDamage,
      modifiers,
      attacker.stress.isStressed,
    ) +
    exposed +
    laserHitBonus({
      attacker,
      target: boss,
      attackerHasWingman: input.attackerHasWingman,
      nowMs: input.nowMs,
    });
  return Math.max(MIN_BOSS_HIT_DAMAGE, raw - boss.armor);
}

/**
 * Damage an equipped ship takes from a boss ability, after its mitigation.
 *
 * @param damage - The ability's damage.
 * @param modifiers - The defending ship's modifier sheet.
 * @param allyNear - Whether a friendly ship flies near the defender.
 * @returns Mitigated damage, never below one point for a non-zero hit.
 */
export function mitigateBossDamage(
  damage: number,
  modifiers: CombatModifiers,
  allyNear: boolean,
): number {
  if (damage <= 0) return 0;
  const multiplier = incomingDamageMultiplier(modifiers, allyNear);
  return Math.max(1, Math.round(damage * multiplier));
}
