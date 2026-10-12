/**
 * PilotAbilityCombat — the moments a pilot ability acts in a fight: the
 * conditional laser bonus when a bolt lands, the reward for a kill (shields,
 * frenzy) and the blast when a ship that carries one is destroyed.
 *
 * Pure: no Phaser. Scenes call these at their hit / kill points.
 */

import { ORDNANCE_DAMAGE_SCALE } from "../config";
import type { ShipPose } from "../core/ArcadeControls";
import type { CombatModifiers } from "../core/CombatModifiers";
import type { StressState } from "./ArcadeStress";
import {
  conditionalLaserBonus,
  DEATH_BLAST_RADIUS_PX,
  describeShot,
  KILL_FRENZY_MS,
  WINGMAN_RADIUS_PX,
} from "./ShotConditions";

/** What the ability hooks read of a ship. */
export interface AbilityCombatant extends ShipPose {
  readonly id: string;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  readonly stress: StressState;
  readonly modifiers: CombatModifiers;
  /** Scene time (ms) until which the kill frenzy lasts. */
  readonly frenzyUntilMs: number;
}

/** A point with an identity (allies / blast candidates). */
export interface PositionedShip {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/**
 * Whether another friendly ship flies within wingman range.
 *
 * @param ship - The ship asking.
 * @param allies - Living ships of the same side (may include `ship`).
 * @returns True when at least one other ally is within range.
 */
export function hasWingman(
  ship: PositionedShip,
  allies: readonly PositionedShip[],
): boolean {
  return allies.some(
    (ally) =>
      ally.id !== ship.id &&
      Math.hypot(ally.x - ship.x, ally.y - ship.y) <= WINGMAN_RADIUS_PX,
  );
}

/** Inputs for {@link laserHitBonus}. */
export interface LaserHitInput {
  readonly attacker: AbilityCombatant;
  readonly target: ShipPose;
  readonly attackerHasWingman: boolean;
  readonly nowMs: number;
}

/**
 * Extra laser damage the attacker's pilot ability adds to a bolt that just
 * hit, judged at the moment of the hit.
 *
 * @param input - Attacker, target pose, wingman presence and scene time.
 * @returns Extra damage (0 when no condition holds).
 */
export function laserHitBonus(input: LaserHitInput): number {
  const { attacker } = input;
  return conditionalLaserBonus(attacker.modifiers, {
    ...describeShot(attacker, input.target),
    allyNear: input.attackerHasWingman,
    isStressed: attacker.stress.isStressed,
    isDamaged: attacker.hull < attacker.maxHull,
    frenzyActive: input.nowMs < attacker.frenzyUntilMs,
  });
}

/** What a kill gives back to the pilot that made it. */
export interface KillReward {
  readonly shields: number;
  readonly frenzyUntilMs: number;
}

/**
 * Reward for a kill: shields restored (real-time HP, applied as is — like
 * every regen/repair knob) and a fresh frenzy window (only for pilots whose ability
 * grants them).
 *
 * @param attacker - The ship that made the kill.
 * @param nowMs - Scene time of the kill.
 * @returns Its new shields and frenzy deadline.
 */
export function rewardKill(
  attacker: AbilityCombatant,
  nowMs: number,
): KillReward {
  const { modifiers } = attacker;
  return {
    shields: Math.min(
      attacker.maxShields,
      attacker.shields + modifiers.shieldsPerKill,
    ),
    frenzyUntilMs:
      modifiers.killFrenzyLaserBonus > 0
        ? nowMs + KILL_FRENZY_MS
        : attacker.frenzyUntilMs,
  };
}

/**
 * Ships caught in a destroyed ship's death blast.
 *
 * @param victim - The ship just destroyed.
 * @param enemies - Living enemies of the victim.
 * @returns Enemies within the blast radius (none without a death blast).
 */
export function deathBlastTargets<T extends PositionedShip>(
  victim: AbilityCombatant,
  enemies: readonly T[],
): T[] {
  if (victim.modifiers.deathBlastDamage <= 0) return [];
  return enemies.filter(
    (enemy) =>
      Math.hypot(enemy.x - victim.x, enemy.y - victim.y) <=
      DEATH_BLAST_RADIUS_PX,
  );
}

/**
 * Damage a destroyed ship's death blast deals to each ship caught in it.
 *
 * @param victim - The ship just destroyed.
 * @returns Blast damage (card damage at ordnance scale; 0 without a blast).
 */
export function deathBlastDamage(victim: AbilityCombatant): number {
  return victim.modifiers.deathBlastDamage * ORDNANCE_DAMAGE_SCALE;
}
