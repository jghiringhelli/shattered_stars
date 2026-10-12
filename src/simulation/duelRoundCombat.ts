/**
 * duelRoundCombat — a duel round's state and its primary-weapon fire, as the
 * Dogfight / Ace Duel scenes resolve it (DuelPrimaryFire target choice, dice
 * attack with the squad mark and armour, stress, shields then hull, hit
 * immunity, a cloaked target's damage factor), timed on the round's tempo
 * (flight clock). Secondary hits land through {@link strike} too
 * (duelRoundWeapons). Used by DuelTempoSim.
 *
 * Mutates the round. Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE, LOGIC_DELTA } from "../config";
import { applyInstantStress } from "../arcade/ArcadeStress";
import type { HitImmunityLedger } from "../arcade/systems/CombatTempo";
import { armorReductionOf, shotAurasOf } from "../arcade/systems/DamageRules";
import {
  duelShotOdds,
  marksmanshipDamage,
} from "../arcade/systems/AceDuelAbilities";
import type { ActiveAura } from "../systems/SupportAura";
import type { DamagePauseTracker } from "../arcade/systems/repair/HullRepair";
import type { WeaponsDriver } from "../arcade/weapons/WeaponsDriver";
import {
  absorbDamage,
  combatantOf,
  resolveDiceAttack,
} from "../arcade/systems/DiceAttack";
import type { DuelBotCrew } from "../arcade/systems/DuelBotCrew";
import { primaryShotTarget } from "../arcade/systems/DuelPrimaryFire";
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
  /** Primary hits (hit rate = hits / attacks). */
  readonly hits: Record<1 | 2, number>;
  /** Ordnance and turret hits. */
  readonly ordnanceHits: Record<1 | 2, number>;
  /** Damage from every weapon. */
  readonly damage: Record<1 | 2, number>;
  readonly hitTimes: Map<string, number[]>;
  /** Real time (ms). */
  nowMs: number;
  firstKillMs: number | null;
  specialsUsed: number;
  /** The ships' secondaries (duelRoundWeapons.armRound). */
  weapons?: WeaponsDriver;
  /** Faction auras covering each ship this frame (hero pilots in 2v2). */
  auras?: ReadonlyMap<string, ActiveAura>;
  /** Time since each ship last took damage (hull repair pause). */
  repairs?: DamagePauseTracker;
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
    worldSize: BATTLEFIELD_SIZE,
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
  const { hitChance, extraDamageChance } = duelShotOdds(attacker, target);
  const roll = state.rng.next();
  const result = resolveDiceAttack({
    attacker: combatantOf(attacker),
    target: combatantOf(target),
    hitChance,
    baseDamage:
      attacker.combatStats.attackDice +
      marksmanshipDamage(roll, hitChance, extraDamageChance),
    attackerHasWingman: false,
    targetHasWingman: false,
    nowMs: flightNow(state),
    roll,
    targetMarked: state.crew.isMarkedShot(
      attacker.id,
      target.id,
      flightNow(state),
    ),
    ...shotAurasOf(state.auras ?? new Map(), attacker.id, target.id),
    targetArmor: armorReductionOf(target.definitionId),
  });
  state.weapons?.onAttack(attacker.id);
  if (!result.hit) return;
  const cloak = state.weapons?.incomingDamageFactor(target.id) ?? 1;
  const damage =
    cloak < 1 ? Math.max(1, Math.round(result.damage * cloak)) : result.damage;
  state.hits[attacker.side] += 1;
  strike(state, attacker, target, { damage, stress: result.stressOnTarget });
}

/**
 * Land a hit: stress, shields then hull, the tempo ledger, the hit log and
 * the kill.
 * @param state - The round (mutated).
 * @param attacker - Who hit.
 * @param target - Who was hit.
 * @param hit - Final damage and stress.
 */
export function strike(
  state: RoundState,
  attacker: DuelSimShip,
  target: DuelSimShip,
  hit: { readonly damage: number; readonly stress: number },
): void {
  target.flight = {
    ...target.flight,
    stress: applyInstantStress(target.flight.stress, hit.stress),
  };
  const before = target.hull + target.shields;
  Object.assign(target, absorbDamage(target, hit.damage));
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
