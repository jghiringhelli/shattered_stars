/**
 * DuelTempoSim — headless AI-vs-AI duel round on the same pure modules the
 * Dogfight / Ace Duel scenes run each frame: cycle flight, duel pursuit AI,
 * quick-build equipment, dice attacks and the round tempo (one attack per
 * maneuver cycle, hit immunity per attacker). Measures how long a round
 * lasts so the DURABILITY_SCALE / tempo decisions can be judged in numbers.
 *
 * Not modelled: wingman bonuses and death blasts (they change nothing
 * before the first kill in a 1v1), player input, Ace Duel ad-hoc dice
 * abilities.
 */

import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS, LOGIC_DELTA } from "../config";
import { applyInstantStress } from "../arcade/ArcadeStress";
import { closestPoint, planDuelSteer } from "../arcade/systems/AiPursuit";
import type { DuelDifficulty } from "../arcade/systems/AiPursuit";
import { HitImmunityLedger } from "../arcade/systems/CombatTempo";
import {
  pursuitSpeed,
  steerAiFlight,
  tickCycleFlight,
} from "../arcade/systems/CycleFlight";
import {
  absorbDamage,
  combatantOf,
  resolveDiceAttack,
} from "../arcade/systems/DiceAttack";
import {
  primaryCooldownAfterShot,
  primaryShotTarget,
} from "../arcade/systems/DuelPrimaryFire";
import {
  regenerateShields,
  stressModifiersOf,
} from "../arcade/systems/QuickBuildEquip";
import { calculateHitChance } from "../data/ModeBalancing";
import { createSeededRng, type RandomGenerator } from "../utils/random";
import { spawnDuelSide, type DuelSimShip } from "./duelSimShips";

/** The ROUND banner (ms) during which ships close in with weapons cold. */
export const DUEL_BANNER_MS = 1500;
/** Round time limit (ms) of both duel scenes. */
export const DUEL_ROUND_LIMIT_MS = 180_000;

/** One simulated round. */
export interface DuelTempoConfig {
  /** Ship definition ids of side 1 (spawns south, facing north). */
  readonly side1: readonly string[];
  /** Ship definition ids of side 2 (spawns north, facing south). */
  readonly side2: readonly string[];
  readonly seed: number;
  /** AI difficulty of both pilots (equal pilots). Default "normal". */
  readonly difficulty?: DuelDifficulty;
}

/** What happened in a round. */
export interface DuelTempoResult {
  /** Time from weapons-live to the last kill (ms); null when it timed out. */
  readonly durationMs: number | null;
  readonly winner: 1 | 2 | null;
  /** Attacks made (hit or miss) by each side. */
  readonly attacks: Readonly<Record<1 | 2, number>>;
  /** Scene time (ms) of every damaging hit, keyed "attacker>target". */
  readonly hitTimes: ReadonlyMap<string, readonly number[]>;
}

interface RoundState {
  readonly ships: DuelSimShip[];
  readonly ledger: HitImmunityLedger;
  readonly rng: RandomGenerator;
  readonly difficulty: DuelDifficulty;
  readonly attacks: Record<1 | 2, number>;
  readonly hitTimes: Map<string, number[]>;
  nowMs: number;
}

/**
 * Fly and fight one duel round at the fixed logic step.
 *
 * @param config - Sides, seed and pilot difficulty.
 * @returns Duration, winner, attack counts and hit log.
 */
export function simulateDuelRound(config: DuelTempoConfig): DuelTempoResult {
  const state: RoundState = {
    ships: [
      ...spawnDuelSide(1, config.side1),
      ...spawnDuelSide(2, config.side2),
    ],
    ledger: new HitImmunityLedger(),
    rng: createSeededRng(config.seed),
    difficulty: config.difficulty ?? "normal",
    attacks: { 1: 0, 2: 0 },
    hitTimes: new Map(),
    nowMs: 0,
  };
  const endMs = DUEL_BANNER_MS + DUEL_ROUND_LIMIT_MS;
  let winner: 1 | 2 | null = null;
  while (state.nowMs < endMs && winner === null) {
    state.nowMs += LOGIC_DELTA;
    stepRound(state);
    winner = survivingSide(state.ships);
  }
  return {
    durationMs: winner === null ? null : state.nowMs - DUEL_BANNER_MS,
    winner,
    attacks: state.attacks,
    hitTimes: state.hitTimes,
  };
}

/**
 * Median of the finished rounds' durations.
 *
 * @param results - Simulated rounds.
 * @returns Median duration (ms), or null when every round timed out.
 */
export function medianDurationMs(
  results: readonly DuelTempoResult[],
): number | null {
  const sorted = results
    .map((r) => r.durationMs)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function stepRound(state: RoundState): void {
  for (const ship of living(state.ships)) steer(state, ship);
  for (const ship of living(state.ships)) fly(ship);
  if (state.nowMs <= DUEL_BANNER_MS) return;
  for (const ship of living(state.ships)) fireIfReady(state, ship);
}

function steer(state: RoundState, ship: DuelSimShip): void {
  const target = closestPoint(ship, enemiesOf(state.ships, ship));
  if (!target) return;
  const plan = planDuelSteer({
    ship,
    target,
    owner: "ai",
    difficulty: state.difficulty,
    random: () => state.rng.next(),
  });
  ship.flight = steerAiFlight(ship.flight, {
    headingErrorDeg: plan.headingErrorDeg,
    desiredSpeed: pursuitSpeed(ship.flight.motion.control, plan.trueErrorDeg),
    cycleCommitted: ship.cycleCommitted,
    allowKTurn: plan.allowKTurn,
  }).state;
}

function fly(ship: DuelSimShip): void {
  const tick = tickCycleFlight(ship.flight, {
    deltaMs: LOGIC_DELTA,
    worldSize: BATTLEFIELD_SIZE,
    dial: ship.dial,
    cycleMs: CYCLE_DURATION_MS,
    modifiers: stressModifiersOf(ship.modifiers),
  });
  ship.flight = tick.state;
  ship.x = tick.state.motion.x;
  ship.y = tick.state.motion.y;
  ship.angle = tick.state.motion.angle;
  ship.cycleCommitted = tick.completed !== null;
  ship.shields = regenerateShields(
    ship.shields,
    ship.maxShields,
    ship.modifiers,
    LOGIC_DELTA,
  );
}

function fireIfReady(state: RoundState, ship: DuelSimShip): void {
  ship.weaponCooldown = Math.max(0, ship.weaponCooldown - LOGIC_DELTA);
  if (ship.weaponCooldown > 0) return;
  const target = primaryShotTarget({
    gunner: ship,
    candidates: state.ships,
    isEnemy: (other) => other.side !== ship.side,
    ledger: state.ledger,
    nowMs: state.nowMs,
  });
  if (!target) return;
  attack(state, ship, target);
  ship.weaponCooldown = primaryCooldownAfterShot(ship);
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
    nowMs: state.nowMs,
    roll: state.rng.next(),
  });
  if (!result.hit) return;
  target.flight = {
    ...target.flight,
    stress: applyInstantStress(target.flight.stress, result.stressOnTarget),
  };
  Object.assign(target, absorbDamage(target, result.damage));
  state.ledger.recordHit(attacker.id, target.id, state.nowMs);
  const key = `${attacker.id}>${target.id}`;
  state.hitTimes.set(key, [...(state.hitTimes.get(key) ?? []), state.nowMs]);
  if (target.hull <= 0) state.ledger.forget(target.id);
}

function living(ships: readonly DuelSimShip[]): DuelSimShip[] {
  return ships.filter((ship) => ship.hull > 0);
}

function enemiesOf(
  ships: readonly DuelSimShip[],
  ship: DuelSimShip,
): DuelSimShip[] {
  return living(ships).filter((other) => other.side !== ship.side);
}

function survivingSide(ships: readonly DuelSimShip[]): 1 | 2 | null {
  const alive = new Set(living(ships).map((ship) => ship.side));
  if (alive.size !== 1) return null;
  return alive.has(1) ? 1 : 2;
}
