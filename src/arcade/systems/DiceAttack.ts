/**
 * DiceAttack — one shot in the dice-based battle modes (Dogfight, Ace
 * Duel, Survival, Campaign, Boss Raid, Continuous), with the attacker's
 * equipment and pilot ability applied: flat and calm laser bonuses, the bonus
 * against an unshielded target, conditional ability bonuses judged at the
 * moment of the shot, the defender's damage mitigation, and stress on hit.
 *
 * Pure: the caller rolls (seeded or not) and applies the result.
 */

import {
  laserDamageWithModifiers,
  type CombatModifiers,
} from "../../core/CombatModifiers";
import type { CycleFlightState } from "./CycleFlight";
import { laserHitBonus, type AbilityCombatant } from "../PilotAbilityCombat";
import { incomingDamageMultiplier } from "../ShotConditions";

/** One shot. */
export interface DiceAttackInput {
  readonly attacker: AbilityCombatant;
  readonly target: AbilityCombatant;
  /** Hit probability from the mode's dice model. */
  readonly hitChance: number;
  /** Damage before equipment (the mode's dice damage). */
  readonly baseDamage: number;
  readonly attackerHasWingman: boolean;
  readonly targetHasWingman: boolean;
  /** Scene time (ms), for the kill-frenzy window. */
  readonly nowMs: number;
  /** Uniform roll in [0, 1): the shot hits when roll < hitChance. */
  readonly roll: number;
}

/** What the shot did. */
export interface DiceAttackResult {
  readonly hit: boolean;
  /** Damage to apply (shields first, then hull); 0 on a miss. */
  readonly damage: number;
  /** Stress (0–1 scale) to add to the target's pilot; 0 on a miss. */
  readonly stressOnTarget: number;
}

/** A scene ship record flying the cycle engine with a quick build equipped. */
export interface EquippedShip {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  readonly flight: CycleFlightState;
  readonly modifiers: CombatModifiers;
  readonly frenzyUntilMs: number;
}

/**
 * View a scene ship as an ability combatant (stress lives on its flight).
 *
 * @param ship - The scene's ship record.
 * @returns The combatant view.
 */
export function combatantOf(ship: EquippedShip): AbilityCombatant {
  return { ...ship, stress: ship.flight.stress };
}

const MISS: DiceAttackResult = { hit: false, damage: 0, stressOnTarget: 0 };

/**
 * Resolve one shot.
 *
 * @param input - Attacker, target, dice odds and damage, context and roll.
 * @returns Hit, damage after equipment and mitigation, stress inflicted.
 */
export function resolveDiceAttack(input: DiceAttackInput): DiceAttackResult {
  if (input.roll >= input.hitChance) return MISS;
  const { attacker, target } = input;
  const modifiers = attacker.modifiers;
  const exposed = target.shields <= 0 ? modifiers.bonusDamageVsUnshielded : 0;
  const raw =
    laserDamageWithModifiers(
      input.baseDamage,
      modifiers,
      attacker.stress.isStressed,
    ) +
    exposed +
    laserHitBonus({
      attacker,
      target,
      attackerHasWingman: input.attackerHasWingman,
      nowMs: input.nowMs,
    });
  const mitigation = incomingDamageMultiplier(
    target.modifiers,
    input.targetHasWingman,
  );
  return {
    hit: true,
    damage: Math.max(1, Math.round(raw * mitigation)),
    stressOnTarget: modifiers.stressOnHit,
  };
}

/** Shields and hull of a ship taking damage. */
export interface Durability {
  readonly shields: number;
  readonly hull: number;
}

/**
 * Damage taken shields first, then hull.
 *
 * @param ship - Current shields and hull.
 * @param damage - Damage to take.
 * @returns Shields and hull after the damage (never below 0).
 */
export function absorbDamage(ship: Durability, damage: number): Durability {
  const absorbed = Math.min(ship.shields, damage);
  return {
    shields: ship.shields - absorbed,
    hull: Math.max(0, ship.hull - (damage - absorbed)),
  };
}
