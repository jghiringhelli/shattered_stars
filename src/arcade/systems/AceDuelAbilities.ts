/**
 * AceDuelAbilities — how a preset duel ace's pilot abilities act in a shot.
 *
 * Abilities with a real-time reading (PILOT_ABILITY_REALTIME) fold into the
 * ship's modifier sheet next to its quick build, so DiceAttack applies them
 * (regenerative_shields: steady regeneration at its sheet rate). Only duel
 * abilities with no real-time entry keep their ad-hoc reading: extra attack
 * / defense dice and marksmanship's chance of +1 damage. Membership in the
 * table decides, so an ability never acts both ways.
 *
 * Pure: no Phaser, no randomness of its own.
 */

import {
  combineEffects,
  type CombatModifiers,
  type RealtimeEffect,
} from "../../core/CombatModifiers";
import { calculateHitChance } from "../../data/ModeBalancing";
import { PILOT_ABILITY_REALTIME } from "../../data/pilotAbilityEffects";
import { getLoadoutById } from "../../data/ShipLoadouts";
import { PILOT_CARDS } from "../../systems/SquadBuilder";

/** A reroll is worth half a die. */
const REROLL_DICE_VALUE = 0.5;

/** Below this hull fraction, tenacity adds an attack and a defense die. */
const TENACITY_HULL_FRACTION = 0.5;

/** Chance that a marksmanship hit carries extra damage. */
const MARKSMANSHIP_CHANCE = 0.5;

/** Damage marksmanship adds when it lands. */
export const MARKSMANSHIP_EXTRA_DAMAGE = 1;

/** What the duel-only abilities read of a ship. */
export interface DuelAbilityShip {
  readonly abilities: readonly string[];
  readonly hull: number;
  readonly maxHull: number;
  readonly combatStats: {
    readonly attackDice: number;
    readonly agilityDice: number;
  };
}

/** Dice-model bonuses of the duel-only abilities for one shot. */
interface DuelDiceBonuses {
  attackDice: number;
  defenseDice: number;
  attackRerolls: number;
  defenseRerolls: number;
  extraDamageChance: number;
}

/**
 * @param abilityId - A pilot ability id.
 * @returns Whether it acts through the modifier sheet (has a real-time entry).
 */
export function isSheetAbility(abilityId: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    PILOT_ABILITY_REALTIME,
    abilityId,
  );
}

/**
 * @param abilities - A duel ace's ability ids.
 * @returns The ones with no real-time entry, which act ad hoc.
 */
export function adHocAbilities(abilities: readonly string[]): string[] {
  return abilities.filter((id) => !isSheetAbility(id));
}

/**
 * @param loadoutId - A quick build, or null for the bare hull.
 * @returns Its pilot's ability id, or null.
 */
function loadoutAbilityOf(loadoutId: string | null): string | null {
  if (!loadoutId) return null;
  const pilotId = getLoadoutById(loadoutId)?.pilotId;
  return (pilotId && PILOT_CARDS[pilotId]?.abilityId) || null;
}

/**
 * The duel ace's modifier sheet: the quick build's sheet with every duel
 * ability that has a real-time entry folded in. The quick build pilot's own
 * ability is already on its sheet and is not counted twice.
 *
 * @param loadoutSheet - Sheet from equipQuickBuild.
 * @param abilities - The duel ace's ability ids.
 * @param loadoutId - The quick build flown, or null.
 * @returns The combined, clamped sheet.
 */
export function duelModifiers(
  loadoutSheet: CombatModifiers,
  abilities: readonly string[],
  loadoutId: string | null,
): CombatModifiers {
  const alreadyOnSheet = loadoutAbilityOf(loadoutId);
  const effects = [...new Set(abilities)]
    .filter((id) => id !== alreadyOnSheet && isSheetAbility(id))
    .map((id): RealtimeEffect => PILOT_ABILITY_REALTIME[id]!);
  return combineEffects([loadoutSheet, ...effects]);
}

/**
 * Dice bonuses the duel abilities with no real-time entry give a ship in a
 * shot (sheet abilities are skipped: DiceAttack already applies them).
 *
 * @param ship - The ship whose abilities apply.
 * @param opponent - The other ship in the shot.
 * @returns Its dice bonuses.
 */
function diceBonusesOf(
  ship: DuelAbilityShip,
  opponent: DuelAbilityShip,
): DuelDiceBonuses {
  const bonuses: DuelDiceBonuses = {
    attackDice: 0,
    defenseDice: 0,
    attackRerolls: 0,
    defenseRerolls: 0,
    extraDamageChance: 0,
  };
  const wounded = ship.hull / ship.maxHull < TENACITY_HULL_FRACTION;
  for (const abilityId of adHocAbilities(ship.abilities)) {
    switch (abilityId) {
      case "marksmanship":
        bonuses.extraDamageChance += MARKSMANSHIP_CHANCE;
        break;
      case "lone_wolf":
        bonuses.attackRerolls += 1;
        bonuses.defenseRerolls += 1;
        break;
      case "outmaneuver":
        bonuses.attackDice += 1;
        break;
      case "tenacity":
        if (wounded) {
          bonuses.attackDice += 1;
          bonuses.defenseDice += 1;
        }
        break;
      case "predatory_instinct":
        if (opponent.hull < opponent.maxHull) bonuses.attackDice += 1;
        break;
      case "stealth_device":
        if (ship.hull >= ship.maxHull) bonuses.defenseDice += 1;
        break;
    }
  }
  return bonuses;
}

/** The dice odds of one duel shot. */
export interface DuelShotOdds {
  /** Hit probability before the difficulty scaling. */
  readonly hitChance: number;
  /** Chance (0–1) that a hit carries marksmanship's extra damage. */
  readonly extraDamageChance: number;
}

/**
 * Dice odds of a shot with the duel-only abilities of both ships applied.
 *
 * @param attacker - The firing ship.
 * @param target - The ship fired at.
 * @returns Hit chance and marksmanship chance.
 */
export function duelShotOdds(
  attacker: DuelAbilityShip,
  target: DuelAbilityShip,
): DuelShotOdds {
  const attack = diceBonusesOf(attacker, target);
  const defense = diceBonusesOf(target, attacker);
  const attackDice =
    attacker.combatStats.attackDice +
    attack.attackDice +
    Math.round(attack.attackRerolls * REROLL_DICE_VALUE);
  const defenseDice =
    target.combatStats.agilityDice +
    defense.defenseDice +
    Math.round(defense.defenseRerolls * REROLL_DICE_VALUE);
  return {
    hitChance: calculateHitChance(attackDice, defenseDice),
    extraDamageChance: Math.min(1, attack.extraDamageChance),
  };
}

/**
 * Marksmanship's extra damage, read from the shot's single roll: among
 * hits (roll < hitChance) the lowest `extraDamageChance` share carry it.
 *
 * @param roll - The shot's uniform roll in [0, 1).
 * @param hitChance - The shot's final hit chance.
 * @param extraDamageChance - Chance a hit carries the extra damage.
 * @returns Extra damage (0 or {@link MARKSMANSHIP_EXTRA_DAMAGE}).
 */
export function marksmanshipDamage(
  roll: number,
  hitChance: number,
  extraDamageChance: number,
): number {
  return roll < Math.min(1, hitChance) * extraDamageChance
    ? MARKSMANSHIP_EXTRA_DAMAGE
    : 0;
}
