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
import { leverShot } from "../ShotLevers";
import type { ActiveAura } from "../../systems/SupportAura";

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
  /**
   * The boss is the attacker's side's marked target (SquadMark): the same
   * +hit / +damage as a marked ship (ShotLevers), damage before armor.
   * Omitted = not marked.
   */
  readonly targetMarked?: boolean;
  /** The faction aura covering the attacker (adds its damage and hit bonus). */
  readonly attackerAura?: ActiveAura;
}

/** Every bolt that hits the boss deals at least this much. */
export const MIN_BOSS_HIT_DAMAGE = 1;

/**
 * Damage a bolt deals to the boss: the squad mark's levers on the odds and
 * damage, the attacker's laser bonuses (flat, calm, vs-unshielded and the
 * pilot's conditional bonus judged against the boss's pose), then the
 * boss's armor. A static hulk has no rear arc or joust to exploit: only
 * the mark lever applies.
 *
 * @param input - Attacker, boss, dice odds and damage, context and roll.
 * @returns Damage to apply (shields first, then a section); 0 on a miss.
 */
export function resolveBossShot(input: BossShotInput): number {
  const levered = leverShot({
    hitChance: input.hitChance + (input.attackerAura?.hitChanceBonus ?? 0),
    position: "neutral",
    marked: input.targetMarked === true,
  });
  if (input.roll >= levered.hitChance) return 0;
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
    levered.damageBonus +
    laserHitBonus({
      attacker,
      target: boss,
      attackerHasWingman: input.attackerHasWingman,
      nowMs: input.nowMs,
    }) +
    (input.attackerAura?.damageBonus ?? 0);
  return Math.max(MIN_BOSS_HIT_DAMAGE, raw - boss.armor);
}

/*
 * Raid calibration — the raid has its own scales instead of DURABILITY_SCALE.
 * Ships are x12 so equal-pilot duels last 30–60 s; a boss on that scale
 * (with ability timers stretched to match) would make one raid an hour long.
 * Calibrated headless against the default squad and the Hegemony
 * Battlecruiser (220 catalogue points, medium):
 * - five ships always in range deal ~5.5 HP/s (one attack per cycle, armor
 *   floors most hits to 1): the boss's 1760 HP fall in ~5.3 min with no
 *   boss abilities; a squad that pulls out of broadside reach around each
 *   ability tick kills it in ~7.3 min with no losses, one that dodges half
 *   the ticks wins about half its raids in ~6 min, one that tanks every
 *   broadside is wiped with the boss at ~70%;
 * - Shield Regeneration restores at most 30 shields per 36 s (<= 0.83/s,
 *   0.3–0.6/s in play) — below even the weak AI squad's 1.1–2.0 HP/s;
 * - a broadside deals 8 / 12 / 16 by phase: a third, a half, two thirds of a
 *   24-HP light fighter, so a ship caught in it is hurt, not one-shot.
 */

/** Real-time HP per catalogue point of a boss pool (hull, shields, sections). */
export const BOSS_HP_SCALE = 8;
/** Real-time damage per rules point of a boss weapon (broadside). */
export const BOSS_DAMAGE_SCALE = 4;
/** Real-time shield points per rules point of the boss's Shield Regeneration. */
export const BOSS_REGEN_SCALE = 3;
/** Boss ability timers (ability tick, cooldowns) relative to the catalogue's. */
export const BOSS_TEMPO_SCALE = 3;
/** Raid time limit (ms): 12 minutes; on timeout points decide the raid. */
export const RAID_CLOCK_MS = 720_000;
/**
 * Real-time hit points of a boss pool (hull, shields or a section): the
 * catalogue's points at the raid difficulty, at BOSS_HP_SCALE.
 *
 * @param catalogPoints - Catalogue value.
 * @param difficultyMultiplier - Raid difficulty multiplier.
 * @returns Real-time hit points.
 */
export function bossDurability(
  catalogPoints: number,
  difficultyMultiplier: number,
): number {
  return Math.floor(catalogPoints * difficultyMultiplier) * BOSS_HP_SCALE;
}

/**
 * A boss weapon's damage (broadside) in real-time points.
 *
 * @param rulesPoints - The rules' damage value.
 * @returns Real-time damage.
 */
export function bossDamagePoints(rulesPoints: number): number {
  return rulesPoints * BOSS_DAMAGE_SCALE;
}

/**
 * Shield points the boss's Shield Regeneration restores in real time.
 *
 * @param rulesPoints - The rules' regeneration value.
 * @returns Real-time shield points.
 */
export function bossRegenPoints(rulesPoints: number): number {
  return rulesPoints * BOSS_REGEN_SCALE;
}

/**
 * A boss ability timer (ability tick, cooldowns) at the raid's tempo.
 *
 * @param catalogMs - The catalogue's timer (ms).
 * @returns The timer in play (ms).
 */
export function bossTempoMs(catalogMs: number): number {
  return catalogMs * BOSS_TEMPO_SCALE;
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
