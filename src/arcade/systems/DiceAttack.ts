/**
 * DiceAttack — one shot in the dice-based battle modes (Dogfight, Ace
 * Duel, Survival, Campaign, Boss Raid, Continuous), with the shot levers
 * (rear-arc bonus, head-on penalty, squad mark — ShotLevers) and the
 * attacker's equipment and pilot ability applied: flat and calm laser
 * bonuses, the bonus against an unshielded target, conditional ability
 * bonuses judged at the moment of the shot, the faction auras covering the
 * attacker (damage, hit chance) and the defender (mitigation), the
 * defender's damage mitigation (DamageRules), and stress on hit.
 *
 * Pure: the caller rolls (seeded or not) and applies the result.
 */

import {
  laserDamageWithModifiers,
  type CombatModifiers,
} from "../../core/CombatModifiers";
import type { CycleFlightState } from "./CycleFlight";
import { laserHitBonus, type AbilityCombatant } from "../PilotAbilityCombat";
import type { ActiveAura } from "../../systems/SupportAura";
import {
  DEFAULT_SHOT_LEVERS,
  LEVER_HIT_CHANCE_CEILING,
  leverShot,
  shotPosition,
  type ShotLevers,
} from "../ShotLevers";
import {
  applyArmor,
  damageMitigationOf,
  ditheredHitDamage,
} from "./DamageRules";

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
  /** Uniform roll in [0, 1): the shot hits when roll < the levered hit chance. */
  readonly roll: number;
  /**
   * The target is the one the attacker's side marked (SquadMark). Omitted =
   * not marked.
   */
  readonly targetMarked?: boolean;
  /** Lever values; omitted = {@link DEFAULT_SHOT_LEVERS} (simulations sweep these). */
  readonly levers?: ShotLevers;
  /**
   * Faction aura covering the attacker: its damage bonus is added to a hit,
   * its hit-chance bonus to the odds. Omitted = no aura.
   */
  readonly attackerAura?: ActiveAura;
  /** Faction aura covering the target: mitigates the hit. Omitted = none. */
  readonly targetAura?: ActiveAura;
  /**
   * The target's flat armor per hit (DamageRules.armorReductionOf), removed
   * before mitigation like Skirmish does. Omitted = no armor.
   */
  readonly targetArmor?: number;
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
 * The mode's hit chance with the attacker's aura bonus, never above the
 * lever ceiling (an aura never makes a shot certain).
 * @param input - The shot.
 * @returns Hit chance before the shot levers.
 */
function auraHitChance(input: DiceAttackInput): number {
  const bonus = input.attackerAura?.hitChanceBonus ?? 0;
  if (bonus <= 0) return input.hitChance;
  const boosted = Math.min(LEVER_HIT_CHANCE_CEILING, input.hitChance + bonus);
  return Math.max(input.hitChance, boosted);
}

/**
 * Damage of a landed hit before the defender's mitigation.
 * @param input - The shot.
 * @param leverDamage - Damage the shot levers add (rear arc, mark).
 * @returns Raw damage.
 */
function rawHitDamage(input: DiceAttackInput, leverDamage: number): number {
  const { attacker, target } = input;
  const modifiers = attacker.modifiers;
  const exposed = target.shields <= 0 ? modifiers.bonusDamageVsUnshielded : 0;
  const laser = laserDamageWithModifiers(
    input.baseDamage,
    modifiers,
    attacker.stress.isStressed,
  );
  const ability = laserHitBonus({
    attacker,
    target,
    attackerHasWingman: input.attackerHasWingman,
    nowMs: input.nowMs,
  });
  const aura = input.attackerAura?.damageBonus ?? 0;
  return laser + exposed + leverDamage + ability + aura;
}

/**
 * Resolve one shot: the mode's odds and damage, moved by the attacker's
 * position (rear arc / head-on) and its squad's mark (ShotLevers), then the
 * attacker's equipment, ability and aura, the defender's armor
 * (DamageRules.applyArmor) and mitigation (own cards, wingman, aura —
 * DamageRules.damageMitigationOf).
 *
 * @param input - Attacker, target, dice odds and damage, context, roll and
 *   (optionally) the auras covering both ships.
 * @returns Hit, damage after equipment and mitigation, stress inflicted.
 */
export function resolveDiceAttack(input: DiceAttackInput): DiceAttackResult {
  const { attacker, target } = input;
  const levered = leverShot(
    {
      hitChance: auraHitChance(input),
      position: shotPosition(attacker, target),
      marked: input.targetMarked === true,
    },
    input.levers ?? DEFAULT_SHOT_LEVERS,
  );
  if (input.roll >= levered.hitChance) return MISS;
  const mitigation = damageMitigationOf(
    target.modifiers,
    input.targetHasWingman,
    input.targetAura,
  );
  const armored = applyArmor(
    rawHitDamage(input, levered.damageBonus),
    input.targetArmor ?? 0,
  );
  return {
    hit: true,
    // A hit roll is uniform on [0, hitChance): reuse it as the rounding dither.
    damage: ditheredHitDamage(
      armored * mitigation,
      input.roll / levered.hitChance,
    ),
    stressOnTarget: attacker.modifiers.stressOnHit,
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
