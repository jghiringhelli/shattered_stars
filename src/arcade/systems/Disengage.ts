/**
 * Disengage — the DISENGAGE REWARD of an ace (spec: docs/specs/aces.md). An
 * ace that was under an enemy's guns and gets clear earns a brief evasion
 * bonus (enemy shots at it hit less: ShotLevers `evading`) and a partial
 * refund of its boost recharge, so it can dash back in sooner. "Clear" is:
 * - leaving the firing arc of an enemy that had it in arc and range, with
 *   at least DISENGAGE_MIN_RANGE_PX between them; or
 * - shaking a squad mark an enemy side had on it.
 * One reward per DISENGAGE_REWARD_COOLDOWN_MS, so a flickering arc is not farmed.
 *
 * Pure: reads positions, writes the book.
 */

import {
  DISENGAGE_BOOST_REFUND,
  DISENGAGE_EVADE_MS,
  DISENGAGE_MIN_RANGE_PX,
  DISENGAGE_REWARD_COOLDOWN_MS,
} from "../../data/aceConfig";
import { inFiringArc, torusOffset, type Shooter } from "../ai/AiGeometry";
import { isMarkedBy, type SquadMarks } from "./SquadMark";
import type { AceStrikeBook, AceStrikeState } from "./AceStrike";

/** A ship as the disengage rule sees it. */
export interface DisengageShip extends Shooter {
  readonly id: string;
  /** Side key (team): enemies are every other side. */
  readonly side: string;
  readonly alive: boolean;
}

/** Everything one disengage pass reads. */
export interface DisengageInput {
  readonly ships: readonly DisengageShip[];
  readonly marks: SquadMarks;
  readonly nowMs: number;
  readonly worldSize: number;
}

/**
 * @param ace - The ace.
 * @param enemies - Living enemies of the ace.
 * @param worldSize - Torus edge (px).
 * @returns Ids of the enemies that have the ace in arc and range now.
 */
function threatsOf(
  ace: DisengageShip,
  enemies: readonly DisengageShip[],
  worldSize: number,
): string[] {
  return enemies
    .filter((enemy) => inFiringArc(enemy, ace, worldSize))
    .map((enemy) => enemy.id);
}

/**
 * @param state - The ace's state.
 * @param ace - The ace.
 * @param enemies - Living enemies.
 * @param threats - Ids that threaten the ace now.
 * @param worldSize - Torus edge (px).
 * @returns Whether a previous threat lost the ace and the range is open.
 */
function brokeAway(
  state: AceStrikeState,
  ace: DisengageShip,
  enemies: readonly DisengageShip[],
  threats: readonly string[],
  worldSize: number,
): boolean {
  return state.threatIds.some((id) => {
    if (threats.includes(id)) return false;
    const enemy = enemies.find((candidate) => candidate.id === id);
    return (
      enemy !== undefined &&
      torusOffset(enemy, ace, worldSize).distance >= DISENGAGE_MIN_RANGE_PX
    );
  });
}

/**
 * One frame of the rule for every living ace in the book.
 *
 * @param book - The battle's book (mutated: threats, marks, evasion).
 * @param input - Ships, marks, time and world.
 * @returns Ids of the aces that earned the reward this frame (the caller
 *   refunds their boost with {@link refundBoost}).
 */
export function updateDisengage(
  book: AceStrikeBook,
  input: DisengageInput,
): string[] {
  const rewarded: string[] = [];
  for (const ace of input.ships) {
    const state = book.get(ace.id);
    if (!state || !ace.alive) continue;
    const enemies = input.ships.filter(
      (ship) => ship.alive && ship.side !== ace.side,
    );
    const threats = threatsOf(ace, enemies, input.worldSize);
    const marked = enemies.some((enemy) =>
      isMarkedBy(input.marks, enemy.side, ace.id, input.nowMs),
    );
    const cleared =
      brokeAway(state, ace, enemies, threats, input.worldSize) ||
      (state.markedByEnemy && !marked);
    state.threatIds = threats;
    state.markedByEnemy = marked;
    if (!cleared || input.nowMs < state.rewardReadyAtMs) continue;
    state.evadeUntilMs = input.nowMs + DISENGAGE_EVADE_MS;
    state.rewardReadyAtMs = input.nowMs + DISENGAGE_REWARD_COOLDOWN_MS;
    rewarded.push(ace.id);
  }
  return rewarded;
}

/**
 * The speed half of the reward: part of the remaining boost recharge is
 * refunded.
 * @param control - The ace's control state (or anything with a boost timer).
 * @returns The control with the shortened boost recharge.
 */
export function refundBoost<T extends { readonly boostCooldown: number }>(
  control: T,
): T {
  return {
    ...control,
    boostCooldown: control.boostCooldown * (1 - DISENGAGE_BOOST_REFUND),
  };
}
