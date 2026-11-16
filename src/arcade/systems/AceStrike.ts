/**
 * AceStrike — the STRIKE WINDOW of an ace (spec: docs/specs/aces.md). A dash
 * (boost, barrel roll, Snap turn / Hook / Knife) opens a short window in
 * which the ace's next shot is a strike: easier to land and harder hitting
 * (ShotLevers reads `strike`). It also holds the other per-ace state of the
 * hit-and-run mechanics: the evasion bonus a disengage earns (Disengage).
 *
 * State is a plain record per ace in a plain Map (the {@link AceStrikeBook}),
 * so lockstep snapshots and hashes capture it with the rest of the sim.
 * Only enlisted aces have an entry: everyone else is unaffected.
 *
 * Pure: no Phaser, no clock, no randomness.
 */

import {
  STRIKE_WINDOW_MS,
  STRIKE_WINDOW_SHOTS,
} from "../../data/aceConfig";
import type { FlightEvent } from "./PilotFlightTypes";

/** What one ace remembers between frames. */
export interface AceStrikeState {
  /** The strike window is open until this scene time (ms). */
  strikeUntilMs: number;
  /** Strike shots left in the open window. */
  strikeShotsLeft: number;
  /** The disengage evasion bonus lasts until this scene time (ms). */
  evadeUntilMs: number;
  /** The next disengage reward is allowed from this scene time (ms). */
  rewardReadyAtMs: number;
  /** Enemies that had the ace in their firing arc and range last frame. */
  threatIds: string[];
  /** An enemy side had the ace marked last frame. */
  markedByEnemy: boolean;
}

/** Every enlisted ace's state, by ship id. */
export type AceStrikeBook = Map<string, AceStrikeState>;

/** Flight events that are a dash into (or out of) the fight. */
const DASH_EVENTS: ReadonlySet<FlightEvent> = new Set<FlightEvent>([
  "boost",
  "barrel_roll",
  "kturn",
  "segnor",
  "tallon",
]);

/** @returns An empty book (no ace enlisted). */
export function createAceStrikeBook(): AceStrikeBook {
  return new Map();
}

/**
 * Enlist a ship as an ace (a no-op when it already is).
 * @param book - The battle's book (mutated).
 * @param shipId - The ace.
 */
export function enlistAce(book: AceStrikeBook, shipId: string): void {
  if (book.has(shipId)) return;
  book.set(shipId, {
    strikeUntilMs: 0,
    strikeShotsLeft: 0,
    evadeUntilMs: 0,
    rewardReadyAtMs: 0,
    threatIds: [],
    markedByEnemy: false,
  });
}

/**
 * Drop a ship (destroyed or left the battle).
 * @param book - The battle's book (mutated).
 * @param shipId - The ship.
 */
export function forgetAce(book: AceStrikeBook, shipId: string): void {
  book.delete(shipId);
}

/**
 * An ace that dashed opens its strike window; other ships and other events
 * change nothing.
 * @param book - The battle's book (mutated).
 * @param shipId - The ship that flew a frame.
 * @param events - The flight events of that frame.
 * @param nowMs - Scene time (ms).
 */
export function noteFlightEvents(
  book: AceStrikeBook,
  shipId: string,
  events: readonly FlightEvent[],
  nowMs: number,
): void {
  const state = book.get(shipId);
  if (!state || !events.some((event) => DASH_EVENTS.has(event))) return;
  state.strikeUntilMs = nowMs + STRIKE_WINDOW_MS;
  state.strikeShotsLeft = STRIKE_WINDOW_SHOTS;
}

/**
 * @param book - The battle's book.
 * @param shipId - The ship about to shoot.
 * @param nowMs - Scene time (ms).
 * @returns Whether its next shot is a strike (ace, window open, shot left).
 */
export function strikeReady(
  book: AceStrikeBook,
  shipId: string,
  nowMs: number,
): boolean {
  const state = book.get(shipId);
  return !!state && state.strikeShotsLeft > 0 && nowMs < state.strikeUntilMs;
}

/**
 * The ace fired: its window spends a shot (hit or miss).
 * @param book - The battle's book (mutated).
 * @param shipId - The shooter.
 * @param nowMs - Scene time (ms).
 */
export function spendStrikeShot(
  book: AceStrikeBook,
  shipId: string,
  nowMs: number,
): void {
  if (!strikeReady(book, shipId, nowMs)) return;
  book.get(shipId)!.strikeShotsLeft -= 1;
}

/**
 * @param book - The battle's book.
 * @param shipId - The ship being shot at.
 * @param nowMs - Scene time (ms).
 * @returns Whether it is an ace flying its disengage evasion bonus.
 */
export function isEvading(
  book: AceStrikeBook,
  shipId: string,
  nowMs: number,
): boolean {
  const state = book.get(shipId);
  return !!state && nowMs < state.evadeUntilMs;
}

/** The DiceAttack flags of one shot. */
export interface AceShotFlags {
  readonly attackerStrike: boolean;
  readonly targetEvading: boolean;
}

/**
 * The ace flags of a shot; a strike spends the window's shot.
 * @param book - The battle's book (mutated when a strike is spent).
 * @param attackerId - The shooter.
 * @param targetId - Its target.
 * @param nowMs - Scene time (ms).
 * @returns Whether the shot is a strike, and whether the target evades.
 */
export function takeShotFlags(
  book: AceStrikeBook,
  attackerId: string,
  targetId: string,
  nowMs: number,
): AceShotFlags {
  const attackerStrike = strikeReady(book, attackerId, nowMs);
  if (attackerStrike) spendStrikeShot(book, attackerId, nowMs);
  return { attackerStrike, targetEvading: isEvading(book, targetId, nowMs) };
}
