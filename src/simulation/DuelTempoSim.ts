/**
 * DuelTempoSim — headless AI-vs-AI duel round on the same pure modules the
 * Dogfight / Ace Duel scenes run each frame: every ship flown by a BotPilot
 * of the given tier through DuelBotCrew (the scenes' AI crew — sides of 2+
 * ships under a SquadCommand that marks its focus), cycle flight,
 * quick-build equipment, dice attacks with the squad mark, and the round
 * tempo (one attack per maneuver cycle, hit immunity per attacker).
 * Measures how long a round lasts so the DURABILITY_SCALE / tempo decisions
 * can be judged in numbers.
 *
 * Not modelled: wingman bonuses and death blasts (they change nothing
 * before the first kill in a 1v1), Ace Duel ad-hoc dice abilities.
 */

import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS, LOGIC_DELTA } from "../config";
import { applyInstantStress } from "../arcade/ArcadeStress";
import type { BotContact, BotTier } from "../arcade/ai";
import { HitImmunityLedger } from "../arcade/systems/CombatTempo";
import { tickCycleFlight } from "../arcade/systems/CycleFlight";
import {
  absorbDamage,
  combatantOf,
  resolveDiceAttack,
} from "../arcade/systems/DiceAttack";
import { DuelBotCrew } from "../arcade/systems/DuelBotCrew";
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
/** Tier both sides fly at when none is given (Normal difficulty). */
export const DEFAULT_DUEL_TIER: BotTier = "average";

/** One simulated round. */
export interface DuelTempoConfig {
  /** Ship definition ids of side 1 (spawns south, facing north). */
  readonly side1: readonly string[];
  /** Ship definition ids of side 2 (spawns north, facing south). */
  readonly side2: readonly string[];
  readonly seed: number;
  /** Bot tier of every pilot (equal pilots). Default {@link DEFAULT_DUEL_TIER}. */
  readonly tier?: BotTier;
  /** Reaction multiplier of every pilot (Brutal: 0.5). Default 1. */
  readonly reactionScale?: number;
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
  readonly crew: DuelBotCrew;
  readonly ledger: HitImmunityLedger;
  readonly rng: RandomGenerator;
  readonly attacks: Record<1 | 2, number>;
  readonly hitTimes: Map<string, number[]>;
  nowMs: number;
}

/**
 * Fly and fight one duel round at the fixed logic step.
 *
 * @param config - Sides, seed and pilot tier.
 * @returns Duration, winner, attack counts and hit log.
 */
export function simulateDuelRound(config: DuelTempoConfig): DuelTempoResult {
  const ships = [
    ...spawnDuelSide(1, config.side1),
    ...spawnDuelSide(2, config.side2),
  ];
  const rng = createSeededRng(config.seed);
  const state: RoundState = {
    ships,
    crew: crewFor(ships, config, () => rng.next()),
    ledger: new HitImmunityLedger(),
    rng,
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

/**
 * @param ships - Every ship of the round.
 * @param config - Pilot tier and reaction.
 * @param random - The round's seeded source (pilots draw from it).
 * @returns An all-AI crew: every ship a bot of the tier.
 */
function crewFor(
  ships: readonly DuelSimShip[],
  config: DuelTempoConfig,
  random: () => number,
): DuelBotCrew {
  const skill = {
    tier: config.tier ?? DEFAULT_DUEL_TIER,
    reactionScale: config.reactionScale ?? 1,
  };
  return new DuelBotCrew({
    roster: ships.map((ship) => ({
      shipId: ship.id,
      side: sideKey(ship.side),
      skill,
    })),
    playerSide: null,
    random,
    worldSize: BATTLEFIELD_SIZE,
  });
}

/**
 * @param side - A duel side.
 * @returns Its side key (as the Ace Duel scene names it).
 */
function sideKey(side: 1 | 2): string {
  return `side${side}`;
}

function stepRound(state: RoundState): void {
  const contacts = state.crew.contactsOf(state.ships);
  state.crew.command(contacts, state.nowMs);
  for (const ship of living(state.ships)) pilot(state, ship, contacts);
  for (const ship of living(state.ships)) fly(state, ship);
  if (state.nowMs <= DUEL_BANNER_MS) return;
  for (const ship of living(state.ships)) fireIfReady(state, ship);
}

/**
 * The ship's bot flies one frame through the player's controls.
 * @param state - The round.
 * @param ship - The ship.
 * @param contacts - Every ship as the AI sees it.
 */
function pilot(
  state: RoundState,
  ship: DuelSimShip,
  contacts: readonly BotContact[],
): void {
  const result = state.crew.fly(ship, contacts, state.nowMs, LOGIC_DELTA);
  if (result) setFlight(ship, result.motion, result.stress);
}

function fly(state: RoundState, ship: DuelSimShip): void {
  const tick = tickCycleFlight(ship.flight, {
    deltaMs: LOGIC_DELTA,
    worldSize: BATTLEFIELD_SIZE,
    dial: ship.dial,
    cycleMs: CYCLE_DURATION_MS,
    modifiers: stressModifiersOf(ship.modifiers),
  });
  setFlight(ship, tick.state.motion, tick.state.stress);
  ship.shields = regenerateShields(
    ship.shields,
    ship.maxShields,
    ship.modifiers,
    LOGIC_DELTA,
  );
  if (tick.completed) state.crew.onCycleCommitted(ship);
}

/**
 * Store a new motion / stress and mirror the pose onto the record.
 * @param ship - The ship.
 * @param motion - Its new motion.
 * @param stress - Its new pilot stress.
 */
function setFlight(
  ship: DuelSimShip,
  motion: DuelSimShip["flight"]["motion"],
  stress: DuelSimShip["flight"]["stress"],
): void {
  ship.flight = { motion, stress };
  ship.x = motion.x;
  ship.y = motion.y;
  ship.angle = motion.angle;
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
    preferredId: state.crew.targetOf(ship.id),
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
    targetMarked: state.crew.isMarkedShot(attacker.id, target.id, state.nowMs),
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
  if (target.hull > 0) return;
  state.ledger.forget(target.id);
  state.crew.forget(target.id);
}

function living(ships: readonly DuelSimShip[]): DuelSimShip[] {
  return ships.filter((ship) => ship.hull > 0);
}

function survivingSide(ships: readonly DuelSimShip[]): 1 | 2 | null {
  const alive = new Set(living(ships).map((ship) => ship.side));
  if (alive.size !== 1) return null;
  return alive.has(1) ? 1 : 2;
}
