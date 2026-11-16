/**
 * ArenaCombat — one tick of primary-weapon fire in the skill arena, the way
 * the dice-mode scenes fight (DogfightScene.processCombat / findTarget /
 * fireAt) under the CombatTempo round model: one attack per weapon interval,
 * a struck target immune to that attacker for a cycle, dice hit chance,
 * DiceAttack damage with equipment and pilot ability, stress on hit, shields
 * then hull, kill rewards and death blasts, kills scored by BattleScore.
 * Lever rules (ArenaRules) adjust hit chance, damage and stress when on.
 *
 * Torus-aware throughout. Mutates the arena's ship records and tallies.
 */

import { applyInstantStress } from "../../arcade/ArcadeStress";
import {
  deathBlastDamage,
  deathBlastTargets,
  rewardKill,
} from "../../arcade/PilotAbilityCombat";
import {
  absorbDamage,
  combatantOf,
  resolveDiceAttack,
} from "../../arcade/systems/DiceAttack";
import {
  armorReductionOf,
  shotAurasOf,
} from "../../arcade/systems/DamageRules";
import { NO_AURAS } from "./ArenaAuras";
import { forgetMarkedTarget } from "../../arcade/systems/SquadMark";
import { creditKill } from "../../systems/arena/BattleScore";
import type { CombatState, SideTally } from "./ArenaCombatState";
import {
  inFiringArc,
  torusOffset,
  unwrapNear,
} from "../../arcade/ai/AiGeometry";
import {
  attackInterval,
  shotHitChance,
  shotStressBonus,
  type ShotContext,
} from "./ArenaRules";
import type { ArenaShip } from "./ArenaShip";
import { recordRecentHit, shotContextOf } from "./ArenaShotContext";
import { takeAceShotFlags } from "./ArenaAce";
import { forgetAce } from "../../arcade/systems/AceStrike";

export {
  emptyTally,
  type CombatState,
  type SideTally,
} from "./ArenaCombatState";

/**
 * Every living ship whose weapon is ready fires at a target in arc and range.
 * @param state - Combat state (mutated).
 * @param nowMs - Arena time (ms).
 * @param deltaMs - Tick length (ms).
 */
export function resolveCombatTick(
  state: CombatState,
  nowMs: number,
  deltaMs: number,
): void {
  for (const ship of state.ships) {
    if (!ship.alive) continue;
    ship.weaponCooldownMs = Math.max(0, ship.weaponCooldownMs - deltaMs);
    if (ship.weaponCooldownMs > 0) continue;
    const target = chooseTarget(ship, state, nowMs);
    if (!target) continue;
    fireAt(ship, target, state, nowMs);
    ship.weaponCooldownMs = attackInterval(
      ship.combatStats.weaponCooldown,
      state.rules,
      state.tempo,
    );
  }
}

/**
 * The enemy a ship shoots: its pilot's chosen target when in arc and range,
 * otherwise the nearest enemy in arc and range not immune to it.
 * @param ship - The shooter.
 * @param state - Combat state.
 * @param nowMs - Arena time (ms).
 * @returns The target, or null when nothing can be shot.
 */
export function chooseTarget(
  ship: ArenaShip,
  state: CombatState,
  nowMs: number,
): ArenaShip | null {
  const shooter = {
    ...ship,
    firingArcDeg: ship.combatStats.firingArc,
    weaponRange: ship.combatStats.weaponRange,
  };
  const wanted = ship.pilot.targetId;
  let best: ArenaShip | null = null;
  let bestDistance = Infinity;
  for (const other of state.ships) {
    if (!other.alive || other.side === ship.side) continue;
    if (!inFiringArc(shooter, other, state.worldSize)) continue;
    if (state.ledger.isImmune(ship.id, other.id, nowMs)) continue;
    if (other.id === wanted) return other;
    const { distance } = torusOffset(ship, other, state.worldSize);
    if (distance < bestDistance) {
      best = other;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * @param tally - The attacking side's tally (mutated).
 * @param shot - The shot's situation.
 */
function countShot(tally: SideTally, shot: ShotContext): void {
  tally.shots += 1;
  if (shot.focusFire) tally.focusFireShots += 1;
  if (shot.crossfire) tally.crossfireShots += 1;
  if (shot.covered) tally.coveredShots += 1;
  if (shot.targetHasWingman) tally.wingmanTargetShots += 1;
  if (shot.marked) tally.markedShots += 1;
}

/**
 * One attack: roll, damage, stress, and the kill if it was one.
 * @param attacker - The shooter.
 * @param target - Its target.
 * @param state - Combat state (mutated).
 * @param nowMs - Arena time (ms).
 */
function fireAt(
  attacker: ArenaShip,
  target: ArenaShip,
  state: CombatState,
  nowMs: number,
): void {
  const tally = state.tallies[attacker.side];
  const shot = shotContextOf(attacker, target, state, nowMs);
  countShot(tally, shot);
  const result = resolveDiceAttack({
    attacker: combatantOf(attacker),
    target: unwrapNear(attacker, combatantOf(target), state.worldSize),
    hitChance: shotHitChance(shot, state.rules),
    baseDamage: attacker.combatStats.attackDice,
    attackerHasWingman: shot.attackerHasWingman,
    targetHasWingman: shot.targetHasWingman,
    nowMs,
    roll: state.random(),
    targetMarked: shot.marked,
    ...takeAceShotFlags(state, attacker, target, nowMs),
    levers: state.rules.shotLevers,
    ...shotAurasOf(state.auras ?? NO_AURAS, attacker.id, target.id),
    targetArmor: armorReductionOf(target.definitionId),
  });
  state.weapons?.onAttack(attacker.id);
  if (!result.hit) return;
  const cloak = state.weapons?.incomingDamageFactor(target.id) ?? 1;
  const damage =
    cloak < 1 ? Math.max(1, Math.round(result.damage * cloak)) : result.damage;
  const stress = result.stressOnTarget + shotStressBonus(shot, state.rules);
  target.flight = {
    ...target.flight,
    stress: applyInstantStress(target.flight.stress, stress),
  };
  Object.assign(target, absorbDamage(target, damage));
  state.ledger.recordHit(attacker.id, target.id, nowMs);
  recordRecentHit(state, attacker, target, nowMs);
  tally.hits += 1;
  tally.damage += damage;
  tally.hitsByArc[shot.position] += 1;
  if (target.hull <= 0) destroyShip(attacker, target, state, nowMs);
}

/**
 * A kill: score it, reward the killer, set off the victim's death blast.
 * @param killer - The ship that made the kill.
 * @param victim - The ship destroyed.
 * @param state - Combat state (mutated).
 * @param nowMs - Arena time (ms).
 */
export function destroyShip(
  killer: ArenaShip,
  victim: ArenaShip,
  state: CombatState,
  nowMs: number,
): void {
  victim.alive = false;
  state.firstKillAtMs ??= nowMs;
  state.ledger.forget(victim.id);
  state.recentHits.delete(victim.id);
  if (state.aceStrike) forgetAce(state.aceStrike, victim.id);
  state.marks = forgetMarkedTarget(state.marks, victim.id);
  state.scores[killer.side] = creditKill(
    state.scores[killer.side],
    victim.definitionId,
  );
  state.tallies[killer.side].kills += 1;
  if (killer.alive)
    Object.assign(killer, rewardKill(combatantOf(killer), nowMs));
  const enemies = state.ships
    .filter((s) => s.alive && s.side !== victim.side)
    .map((s) => unwrapNear(victim, s, state.worldSize));
  const blast = deathBlastDamage(combatantOf(victim));
  for (const caught of deathBlastTargets(combatantOf(victim), enemies)) {
    const ship = state.ships.find((s) => s.id === caught.id);
    if (!ship) continue;
    Object.assign(ship, absorbDamage(ship, blast));
    if (ship.hull <= 0 && ship.alive) destroyShip(victim, ship, state, nowMs);
  }
}
