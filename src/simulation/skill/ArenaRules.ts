/**
 * ArenaRules — the combat rules the skill arena fights by. The defaults are
 * the shared engine exactly: CombatTempo round model, dice hit chance, and
 * DiceAttack with the engine's shot levers (rear arc, head-on, squad mark —
 * ShotLevers.DEFAULT_SHOT_LEVERS). `shotLevers` can be swept; every other
 * field is an UNADOPTED lever prototype, off in {@link ENGINE_RULES}:
 * - cadence: the time between two attacks of one weapon;
 * - wingman: a bonus while an ally flies within wingman range (offence) and
 *   a penalty for shooting a ship that has one (defence aura);
 * - cover: a penalty for attacking a ship whose ally has you in its arc;
 * - focus fire: a bonus against a target an ally hit within the last cycle,
 *   a further bonus when that ally hit from a different angle (crossfire),
 *   and stress when two attackers hit it in one cycle (suppression).
 *
 * Pure: no Phaser.
 */

import { calculateHitChance } from "../../data/ModeBalancing";
import { attackIntervalMs } from "../../arcade/systems/CombatTempo";
import { DEFAULT_SHOT_LEVERS, type ShotLevers } from "../../arcade/ShotLevers";
import type { ArcPosition } from "../../arcade/ai/AiGeometry";
import type { ResolvedTempo } from "../TempoVariant";

/** Combat rules and lever settings. */
export interface ArenaRules {
  /** The engine's shot levers (position, squad mark), sweepable. */
  readonly shotLevers: ShotLevers;
  /** Time between attacks of one weapon; null = engine (CombatTempo). */
  readonly attackIntervalOverrideMs: number | null;
  /** Added to the hit chance while an ally flies within wingman range. */
  readonly wingmanHitBonus: number;
  /** Subtracted from the hit chance against a target flying with a wingman. */
  readonly wingmanDefenseHitPenalty: number;
  /** Subtracted from the hit chance when one of the target's allies has the attacker in its arc. */
  readonly coverHitPenalty: number;
  /** Added to the hit chance against a target an ally hit within the last cycle. */
  readonly focusFireHitBonus: number;
  /**
   * Added to the hit chance when an ally hit the same target within the last
   * cycle from a bearing at least {@link CROSSFIRE_MIN_SEPARATION_DEG} away.
   */
  readonly crossfireHitBonus: number;
  /** Stress (0–1) a hit adds when an ally of the attacker hit the target within the cycle. */
  readonly suppressionStress: number;
  /**
   * The ace hit-and-run mechanics (strike window, disengage reward, ace bot
   * policy) are on for ships flown by an ace. False = the engine before them
   * (the balance report's "before" arm).
   */
  readonly aceMechanics: boolean;
}

/** Two attackers this far apart around a target (°) catch it in a crossfire. */
export const CROSSFIRE_MIN_SEPARATION_DEG = 60;

/** The shared engine as it is today: engine shot levers, prototypes off. */
export const ENGINE_RULES: ArenaRules = {
  shotLevers: DEFAULT_SHOT_LEVERS,
  attackIntervalOverrideMs: null,
  wingmanHitBonus: 0,
  wingmanDefenseHitPenalty: 0,
  coverHitPenalty: 0,
  focusFireHitBonus: 0,
  crossfireHitBonus: 0,
  suppressionStress: 0,
  aceMechanics: true,
};

/** Prototype levers never push the hit chance outside these bounds. */
export const PROTOTYPE_HIT_CHANCE_FLOOR = 0.05;
export const PROTOTYPE_HIT_CHANCE_CEILING = 0.95;

/** What a lever needs to know about one shot. */
export interface ShotContext {
  readonly attackDice: number;
  readonly agilityDice: number;
  /** Where the attacker sits around the target's arcs (reporting). */
  readonly position: ArcPosition;
  readonly attackerHasWingman: boolean;
  readonly targetHasWingman: boolean;
  /** An ally of the attacker hit this target within the last cycle. */
  readonly focusFire: boolean;
  /** ...and from a bearing far enough from the attacker's: a crossfire. */
  readonly crossfire: boolean;
  /** One of the target's allies has the attacker in its arc and range. */
  readonly covered: boolean;
  /** The target is the one the attacker's side marked (SquadMark). */
  readonly marked: boolean;
}

/**
 * The mode's hit chance for a shot plus any prototype lever (the engine's
 * shot levers are applied later, inside DiceAttack).
 *
 * @param shot - Dice and situation of the shot.
 * @param rules - Rules in force.
 * @returns Probability that the shot hits, before the engine's shot levers.
 */
export function shotHitChance(shot: ShotContext, rules: ArenaRules): number {
  const base = calculateHitChance(shot.attackDice, shot.agilityDice);
  const terms: ReadonlyArray<[boolean, number]> = [
    [shot.attackerHasWingman, rules.wingmanHitBonus],
    [shot.targetHasWingman, -rules.wingmanDefenseHitPenalty],
    [shot.covered, -rules.coverHitPenalty],
    [shot.focusFire, rules.focusFireHitBonus],
    [shot.crossfire, rules.crossfireHitBonus],
  ];
  const levers = terms.reduce(
    (sum, [holds, delta]) => (holds ? sum + delta : sum),
    0,
  );
  if (levers === 0) return base;
  return Math.max(
    PROTOTYPE_HIT_CHANCE_FLOOR,
    Math.min(PROTOTYPE_HIT_CHANCE_CEILING, base + levers),
  );
}

/**
 * @param shot - Situation of the shot.
 * @param rules - Rules in force.
 * @returns Extra stress (0–1) the prototype levers add to a hit.
 */
export function shotStressBonus(shot: ShotContext, rules: ArenaRules): number {
  return shot.focusFire ? rules.suppressionStress : 0;
}

/**
 * @param weaponCooldownMs - The weapon's own cooldown (ms).
 * @param rules - Rules in force.
 * @param tempo - What-if tempo (flight clock), if any.
 * @returns Time until the weapon may attack again (ms, on combat's clock).
 */
export function attackInterval(
  weaponCooldownMs: number,
  rules: ArenaRules,
  tempo?: ResolvedTempo,
): number {
  if (!tempo) {
    return rules.attackIntervalOverrideMs ?? attackIntervalMs(weaponCooldownMs);
  }
  return rules.attackIntervalOverrideMs !== null
    ? rules.attackIntervalOverrideMs * tempo.flightScale
    : tempo.attackIntervalMs(weaponCooldownMs);
}
