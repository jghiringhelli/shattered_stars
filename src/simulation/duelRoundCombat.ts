/**
 * duelRoundCombat — a duel round's state and its primary-weapon fire, as the
 * Dogfight / Ace Duel scenes resolve it (DuelPrimaryFire target choice, dice
 * attack with the squad mark, stress, shields then hull, hit immunity),
 * timed on the round's tempo (flight clock). Used by DuelTempoSim.
 *
 * Mutates the round. Pure: no Phaser.
 */

import { LOGIC_DELTA } from "../config";
import { applyInstantStress } from "../arcade/ArcadeStress";
import type { HitImmunityLedger } from "../arcade/systems/CombatTempo";
import {
  absorbDamage,
  combatantOf,
  resolveDiceAttack,
} from "../arcade/systems/DiceAttack";
import type { DuelBotCrew } from "../arcade/systems/DuelBotCrew";
import { primaryShotTarget } from "../arcade/systems/DuelPrimaryFire";
import { calculateHitChance } from "../data/ModeBalancing";
import type { RandomGenerator } from "../utils/random";
import type { DuelSimShip } from "./duelSimShips";
import type { ResolvedTempo } from "./TempoVariant";

/** A round in progress (mutable simulation state). */
export interface RoundState {
  readonly ships: DuelSimShip[];
  readonly crew: DuelBotCrew;
  readonly ledger: HitImmunityLedger;
  readonly rng: RandomGenerator;
  readonly tempo: ResolvedTempo;
  readonly attacks: Record<1 | 2, number>;
  readonly hits: Record<1 | 2, number>;
  readonly damage: Record<1 | 2, number>;
  readonly hitTimes: Map<string, number[]>;
  /** Real time (ms). */
  nowMs: number;
  firstKillMs: number | null;
  specialsUsed: number;
}

/**
 * @param state - The round.
 * @returns The round's flight-clock time (ms).
 */
export function flightNow(state: RoundState): number {
  return state.nowMs * state.tempo.flightScale;
}

/**
 * Fire the ship's primary when ready (one attack per interval, never at an
 * immune target).
 * @param state - The round (mutated).
 * @param ship - The gunner.
 */
export function fireIfReady(state: RoundState, ship: DuelSimShip): void {
  const deltaMs = LOGIC_DELTA * state.tempo.flightScale;
  ship.weaponCooldown = Math.max(0, ship.weaponCooldown - deltaMs);
  if (ship.weaponCooldown > 0) return;
  const target = primaryShotTarget({
    gunner: ship,
    candidates: state.ships,
    isEnemy: (other) => other.side !== ship.side,
    ledger: state.ledger,
    nowMs: flightNow(state),
    preferredId: state.crew.targetOf(ship.id),
  });
  if (!target) return;
  attack(state, ship, target);
  ship.weaponCooldown = state.tempo.attackIntervalMs(
    ship.combatStats.weaponCooldown,
  );
}

function attack(
  state: RoundState,
  attacker: DuelSimShip,
  target: DuelSimShip,
): void {
  state.attacks[attacker.side] += 1;
  const result = resolveDiceAttack({
    attacker: combatantOf(attacker),
    target: combatantOf(target),
    hitChance: calculateHitChance(
      attacker.combatStats.attackDice,
      target.combatStats.agilityDice,
    ),
    baseDamage: attacker.combatStats.attackDice,
    attackerHasWingman: false,
    targetHasWingman: false,
    nowMs: flightNow(state),
    roll: state.rng.next(),
    targetMarked: state.crew.isMarkedShot(
      attacker.id,
      target.id,
      flightNow(state),
    ),
  });
  if (!result.hit) return;
  land(state, attacker, target, result);
}

function land(
  state: RoundState,
  attacker: DuelSimShip,
  target: DuelSimShip,
  result: ReturnType<typeof resolveDiceAttack>,
): void {
  target.flight = {
    ...target.flight,
    stress: applyInstantStress(target.flight.stress, result.stressOnTarget),
  };
  const before = target.hull + target.shields;
  Object.assign(target, absorbDamage(target, result.damage));
  state.hits[attacker.side] += 1;
  state.damage[attacker.side] += before - (target.hull + target.shields);
  state.ledger.recordHit(attacker.id, target.id, flightNow(state));
  const key = `${attacker.id}>${target.id}`;
  state.hitTimes.set(key, [...(state.hitTimes.get(key) ?? []), state.nowMs]);
  if (target.hull > 0) return;
  state.firstKillMs ??= state.nowMs;
  state.ledger.forget(target.id);
  state.crew.forget(target.id);
}

/**
 * @param ships - Ships.
 * @returns The living ones.
 */
export function living(ships: readonly DuelSimShip[]): DuelSimShip[] {
  return ships.filter((ship) => ship.hull > 0);
}
