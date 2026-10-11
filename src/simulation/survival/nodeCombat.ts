/**
 * nodeCombat — primary-weapon fire in a headless Survival node battle,
 * resolved the way SurvivalScene.processCombat does it: the run's passive
 * shield regen, attack interval (fire-rate bonus, mutation, one attack per
 * cycle), arc/range targeting (range bonus, the pilot's wanted target, hit
 * immunity), relic shot adjustments and Scatter bolts, the mode's dice odds
 * (evasion for the player fleet), damage with the run's damage bonus and
 * crits, incoming-damage relics, kill rewards, death blasts, Reactive
 * Shields and boss phases. The boss's subsystems are folded into its hull.
 *
 * Mutates the battle. Pure: no Phaser.
 */

import { applyInstantStress } from "../../arcade/ArcadeStress";
import { nearestTargetInArc } from "../../arcade/systems/ArcTargeting";
import { attackIntervalMs } from "../../arcade/systems/CombatTempo";
import type { HitImmunityLedger } from "../../arcade/systems/CombatTempo";
import {
  absorbDamage,
  combatantOf,
  resolveDiceAttack,
} from "../../arcade/systems/DiceAttack";
import {
  deathBlastDamage,
  deathBlastTargets,
  hasWingman,
  rewardKill,
} from "../../arcade/PilotAbilityCombat";
import { realTimeRunBonuses } from "../../arcade/systems/SurvivalDurability";
import type { SquadBattleAi } from "../../arcade/systems/SquadBattleAi";
import { calculateHitChance } from "../../data/ModeBalancing";
import type { StatBonuses } from "../../data/survival/model";
import type { ShotAdjust } from "../../systems/survival/RelicCombatEngine";
import type { SurvivalBattleRules } from "../../systems/survival/SurvivalBattleRules";
import type { RandomGenerator } from "../../utils/random";
import type { NodeShip } from "./nodeShips";

/** Range (px) one drafted range point adds (scene's RANGE_PER_POINT). */
export const RANGE_PER_POINT = 40;
/** Damage multiplier of a crit (scene's CRIT_DAMAGE_MULTIPLIER). */
export const CRIT_DAMAGE_MULTIPLIER = 2;
/** Floor on the fire-rate cooldown multiplier (scene's MIN_PLAYER_COOLDOWN_MOD). */
export const MIN_PLAYER_COOLDOWN_MOD = 0.5;
/** Relic hit-chance bonuses never push a shot above this (scene's MAX_HIT_CHANCE). */
export const MAX_HIT_CHANCE = 0.95;
const MS_PER_S = 1000;

const NEUTRAL_SHOT: ShotAdjust = {
  hitChanceBonus: 0,
  damageBonus: 0,
  damageMultiplier: 1,
  critChanceBonus: 0,
  shots: 1,
};

/** What combat reads and writes. */
export interface NodeCombat {
  readonly ships: NodeShip[];
  readonly rules: SurvivalBattleRules;
  readonly squadAi: SquadBattleAi;
  readonly ledger: HitImmunityLedger;
  readonly bonuses: Readonly<StatBonuses>;
  readonly rng: RandomGenerator;
  /** Kill handler (bookkeeping, boss phases are separate). */
  readonly onKill: (victim: NodeShip, byPlayer: boolean) => void;
  /** A boss was hit (phase check). */
  readonly onBossHit: (boss: NodeShip) => void;
}

/**
 * One frame of fire for every living ship.
 * @param combat - The battle (mutated).
 * @param nowMs - Battle time (ms).
 * @param deltaMs - Frame length (ms).
 */
export function resolveNodeCombat(
  combat: NodeCombat,
  nowMs: number,
  deltaMs: number,
): void {
  const regen = realTimeRunBonuses(combat.bonuses).shieldRegenPerSecond;
  for (const ship of combat.ships) {
    if (ship.hull <= 0) continue;
    if (
      ship.owner === "player" &&
      regen > 0 &&
      combat.rules.engine.passiveShieldRegen(roleOf(ship))
    )
      ship.shields = Math.min(
        ship.maxShields,
        ship.shields + (regen * deltaMs) / MS_PER_S,
      );
    ship.weaponCooldown = Math.max(0, ship.weaponCooldown - deltaMs);
    if (ship.weaponCooldown > 0) continue;
    const target = findTarget(combat, ship, nowMs);
    if (!target) continue;
    fireAt(combat, ship, target, nowMs);
    ship.weaponCooldown = attackIntervalOf(combat, ship);
  }
}

function roleOf(ship: NodeShip): "flagship" | "escort" {
  return ship.rank === "flagship" ? "flagship" : "escort";
}

function attackIntervalOf(combat: NodeCombat, ship: NodeShip): number {
  const isPlayer = ship.owner === "player";
  const fireRate = isPlayer ? combat.bonuses.fireRate : 0;
  const cooldownMod = Math.max(MIN_PLAYER_COOLDOWN_MOD, 1 - fireRate);
  const mutation = isPlayer
    ? combat.rules.engine.attackIntervalMultiplier(roleOf(ship))
    : 1;
  return attackIntervalMs(
    ship.combatStats.weaponCooldown * cooldownMod * mutation,
  );
}

/**
 * @param combat - The battle.
 * @param ship - The firing ship.
 * @param nowMs - Battle time (ms).
 * @returns Its target: its pilot's wanted target when valid, else the
 *   nearest foe in range and arc not immune to it.
 */
export function findTarget(
  combat: NodeCombat,
  ship: NodeShip,
  nowMs: number,
): NodeShip | null {
  const rangeBonus =
    ship.owner === "player"
      ? combat.bonuses.range * RANGE_PER_POINT +
        combat.rules.engine.rangeBonusPx(roleOf(ship))
      : 0;
  return nearestTargetInArc(ship, combat.ships, {
    rangePx: ship.combatStats.weaponRange + rangeBonus,
    arcDeg: ship.combatStats.firingArc,
    isHostile: (other) => other.owner !== ship.owner,
    isEligible: (other) => !combat.ledger.isImmune(ship.id, other.id, nowMs),
    preferredId: ship.bot?.targetId ?? null,
  });
}

function fireAt(
  combat: NodeCombat,
  attacker: NodeShip,
  target: NodeShip,
  nowMs: number,
): void {
  const marked = combat.squadAi.isMarkedBy(attacker.owner, target.id, nowMs);
  const adjust =
    attacker.owner !== "player"
      ? NEUTRAL_SHOT
      : combat.rules.engine.shot({
          shooterId: attacker.id,
          role: roleOf(attacker),
          targetMarked: marked,
          escortsAlive: Math.max(0, livingPlayers(combat).length - 1),
          nowMs,
        });
  for (let bolt = 0; bolt < adjust.shots && target.hull > 0; bolt++)
    fireBolt(combat, { attacker, target, marked, adjust, nowMs });
}

interface Bolt {
  readonly attacker: NodeShip;
  readonly target: NodeShip;
  readonly marked: boolean;
  readonly adjust: ShotAdjust;
  readonly nowMs: number;
}

function fireBolt(combat: NodeCombat, bolt: Bolt): void {
  const { attacker, target, adjust, nowMs } = bolt;
  const evasion = target.owner === "player" ? combat.bonuses.evasion : 0;
  const result = resolveDiceAttack({
    attacker: combatantOf(attacker),
    target: combatantOf(target),
    hitChance: Math.min(
      MAX_HIT_CHANCE,
      calculateHitChance(
        attacker.combatStats.attackDice,
        target.combatStats.agilityDice + evasion,
      ) + adjust.hitChanceBonus,
    ),
    baseDamage: baseDamageOf(combat, attacker, adjust),
    attackerHasWingman: hasWingman(attacker, sideOf(combat, attacker.owner)),
    targetHasWingman: hasWingman(target, sideOf(combat, target.owner)),
    nowMs,
    roll: combat.rng.next(),
    targetMarked: bolt.marked,
  });
  if (!result.hit) return;
  if (result.stressOnTarget > 0)
    target.flight = {
      ...target.flight,
      stress: applyInstantStress(target.flight.stress, result.stressOnTarget),
    };
  dealDamage(combat, target, result.damage, nowMs);
  if (result.damage > 0) combat.ledger.recordHit(attacker.id, target.id, nowMs);
  if (target.hull > 0) return;
  resolveKill(combat, attacker, target, nowMs);
}

function baseDamageOf(
  combat: NodeCombat,
  attacker: NodeShip,
  adjust: ShotAdjust,
): number {
  if (attacker.owner !== "player") return attacker.combatStats.attackDice;
  const { damage, critChance } = combat.bonuses;
  const base =
    (attacker.combatStats.attackDice + damage + adjust.damageBonus) *
    adjust.damageMultiplier;
  const crit = combat.rng.next() < critChance + adjust.critChanceBonus;
  return crit ? base * CRIT_DAMAGE_MULTIPLIER : base;
}

function dealDamage(
  combat: NodeCombat,
  target: NodeShip,
  incoming: number,
  nowMs: number,
): void {
  const damage =
    target.owner === "player"
      ? incoming *
        combat.rules.engine.incomingMultiplier(
          target.id,
          roleOf(target),
          Math.max(0, livingPlayers(combat).length - 1),
          nowMs,
        )
      : incoming;
  Object.assign(target, absorbDamage(target, damage));
  if (target.rank === "boss") combat.onBossHit(target);
}

function resolveKill(
  combat: NodeCombat,
  killer: NodeShip,
  victim: NodeShip,
  nowMs: number,
): void {
  if (killer.hull > 0)
    Object.assign(killer, rewardKill(combatantOf(killer), nowMs));
  const blast = deathBlastDamage(combatantOf(victim));
  if (killer.owner === "player" && killer.hull > 0) {
    const fraction = combat.rules.engine.killShieldFraction(roleOf(killer));
    if (fraction > 0)
      killer.shields = Math.min(
        killer.maxShields,
        killer.shields + killer.maxShields * fraction,
      );
  }
  combat.onKill(victim, killer.owner === "player");
  if (blast <= 0) return;
  const enemies = combat.ships.filter(
    (s) => s.owner !== victim.owner && s.hull > 0,
  );
  for (const caught of deathBlastTargets(combatantOf(victim), enemies)) {
    dealDamage(combat, caught, blast, nowMs);
    if (caught.hull <= 0) combat.onKill(caught, victim.owner === "player");
  }
}

function sideOf(combat: NodeCombat, owner: NodeShip["owner"]): NodeShip[] {
  return combat.ships.filter((s) => s.owner === owner && s.hull > 0);
}

/**
 * @param combat - The battle.
 * @returns The player's living ships.
 */
export function livingPlayers(combat: NodeCombat): NodeShip[] {
  return sideOf(combat, "player");
}
