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
 * An optional {@link TempoVariant} replays the round at a what-if cycle /
 * special-recharge / attack-cap tempo on a flight clock (see TempoVariant);
 * without one the round is the engine's, bit for bit.
 *
 * Not modelled: wingman bonuses and death blasts (they change nothing
 * before the first kill in a 1v1), Ace Duel ad-hoc dice abilities.
 */

import { BATTLEFIELD_SIZE, LOGIC_DELTA } from "../config";
import type { BotContact, BotTier } from "../arcade/ai";
import { tickCycleFlight } from "../arcade/systems/CycleFlight";
import { DuelBotCrew } from "../arcade/systems/DuelBotCrew";
import {
  regenerateShields,
  stressModifiersOf,
} from "../arcade/systems/QuickBuildEquip";
import { countSpecialActions } from "../telemetry/matchStatTypes";
import { createSeededRng } from "../utils/random";
import { spawnDuelSide, type DuelSimShip } from "./duelSimShips";
import {
  fireIfReady,
  flightNow,
  living,
  type RoundState,
} from "./duelRoundCombat";
import {
  ENGINE_TEMPO,
  immunityLedgerFor,
  resolveTempo,
  scaleControlCooldowns,
  type ResolvedTempo,
  type TempoVariant,
} from "./TempoVariant";

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
  /** Side 2's tier when it differs from side 1's (`tier`). */
  readonly side2Tier?: BotTier;
  /** Reaction multiplier of every pilot (Brutal: 0.5). Default 1. */
  readonly reactionScale?: number;
  /** What-if tempo (experiments); omitted = the engine's. */
  readonly tempo?: TempoVariant;
}

/** What happened in a round (times in real ms). */
export interface DuelTempoResult {
  /** Time from weapons-live to the last kill (ms); null when it timed out. */
  readonly durationMs: number | null;
  readonly winner: 1 | 2 | null;
  /** Attacks made (hit or miss) by each side. */
  readonly attacks: Readonly<Record<1 | 2, number>>;
  /** Scene time (ms) of every damaging hit, keyed "attacker>target". */
  readonly hitTimes: ReadonlyMap<string, readonly number[]>;
  /** Hits landed by each side. */
  readonly hits: Readonly<Record<1 | 2, number>>;
  /** Damage dealt by each side (shields + hull). */
  readonly damage: Readonly<Record<1 | 2, number>>;
  /** Time from weapons-live to the first kill (ms); null when nobody died. */
  readonly firstKillMs: number | null;
  /** Special actions flown by every pilot. */
  readonly specialsUsed: number;
}

/**
 * Fly and fight one duel round at the fixed logic step.
 *
 * @param config - Sides, seed, pilot tiers and tempo.
 * @returns Duration, winner, attack / hit / damage counts and hit log.
 */
export function simulateDuelRound(config: DuelTempoConfig): DuelTempoResult {
  const tempo = resolveTempo(config.tempo ?? ENGINE_TEMPO);
  const ships = [
    ...spawnDuelSide(1, config.side1),
    ...spawnDuelSide(2, config.side2),
  ];
  for (const ship of ships) applyTempo(ship, tempo);
  const rng = createSeededRng(config.seed);
  const state: RoundState = {
    ships,
    crew: crewFor(ships, config, tempo, () => rng.next()),
    ledger: immunityLedgerFor(tempo),
    rng,
    tempo,
    attacks: { 1: 0, 2: 0 },
    hits: { 1: 0, 2: 0 },
    damage: { 1: 0, 2: 0 },
    hitTimes: new Map(),
    nowMs: 0,
    firstKillMs: null,
    specialsUsed: 0,
  };
  const winner = playRound(state);
  return {
    durationMs: winner === null ? null : state.nowMs - DUEL_BANNER_MS,
    winner,
    attacks: state.attacks,
    hitTimes: state.hitTimes,
    hits: state.hits,
    damage: state.damage,
    firstKillMs:
      state.firstKillMs === null ? null : state.firstKillMs - DUEL_BANNER_MS,
    specialsUsed: state.specialsUsed,
  };
}

/**
 * @param state - The round.
 * @returns The winning side, or null when the round timed out.
 */
function playRound(state: RoundState): 1 | 2 | null {
  const endMs = DUEL_BANNER_MS + DUEL_ROUND_LIMIT_MS;
  let winner: 1 | 2 | null = null;
  while (state.nowMs < endMs && winner === null) {
    state.nowMs += LOGIC_DELTA;
    stepRound(state);
    winner = survivingSide(state.ships);
  }
  return winner;
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
 * Express a ship's real-ms action recharge on the tempo's flight clock.
 * @param ship - A freshly spawned ship (mutated).
 * @param tempo - The resolved tempo.
 */
function applyTempo(ship: DuelSimShip, tempo: ResolvedTempo): void {
  const control = scaleControlCooldowns(ship.flight.motion.control, tempo);
  ship.flight = { ...ship.flight, motion: { ...ship.flight.motion, control } };
}

/**
 * @param ships - Every ship of the round.
 * @param config - Pilot tiers and reaction.
 * @param tempo - The tempo (reaction stays fixed in real ms).
 * @param random - The round's seeded source (pilots draw from it).
 * @returns An all-AI crew: every ship a bot of its side's tier.
 */
function crewFor(
  ships: readonly DuelSimShip[],
  config: DuelTempoConfig,
  tempo: ResolvedTempo,
  random: () => number,
): DuelBotCrew {
  const tier1 = config.tier ?? DEFAULT_DUEL_TIER;
  const reactionScale = tempo.reactionScale(config.reactionScale ?? 1);
  return new DuelBotCrew({
    roster: ships.map((ship) => ({
      shipId: ship.id,
      side: `side${ship.side}`,
      skill: {
        tier: ship.side === 1 ? tier1 : (config.side2Tier ?? tier1),
        reactionScale,
      },
    })),
    playerSide: null,
    random,
    worldSize: BATTLEFIELD_SIZE,
  });
}

function stepRound(state: RoundState): void {
  const contacts = state.crew.contactsOf(state.ships);
  state.crew.command(contacts, flightNow(state));
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
  const deltaMs = LOGIC_DELTA * state.tempo.flightScale;
  const result = state.crew.fly(ship, contacts, flightNow(state), deltaMs);
  if (!result) return;
  state.specialsUsed += countSpecialActions(result.events);
  setFlight(ship, result.motion, result.stress);
}

function fly(state: RoundState, ship: DuelSimShip): void {
  const tick = tickCycleFlight(ship.flight, {
    deltaMs: LOGIC_DELTA * state.tempo.flightScale,
    worldSize: BATTLEFIELD_SIZE,
    dial: ship.dial,
    cycleMs: state.tempo.cycleMs,
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

function survivingSide(ships: readonly DuelSimShip[]): 1 | 2 | null {
  const alive = new Set(living(ships).map((ship) => ship.side));
  if (alive.size !== 1) return null;
  return alive.has(1) ? 1 : 2;
}
