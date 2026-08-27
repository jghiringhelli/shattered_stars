/**
 * BattleScore — pure point-cost scoring and timeout tiebreak.
 *
 * Competitive modes end either by elimination or by a match timer. When the
 * timer expires the winner is decided the way the miniatures game scores a
 * timed-out game: by the squad-point value of the enemy ships each side
 * destroyed (margin of victory), NOT by raw kill count. A 100pt gunship is
 * worth far more than a 28pt light fighter.
 *
 * This module owns the scoring numbers only; scenes own when a kill happens
 * and when the timer fires.
 */

import { getShipDefinition } from "../../data/ShipDefinitions";

/** Squad-point value of a ship definition; 0 for unknown ids. */
export function shipPointCost(definitionId: string): number {
  return getShipDefinition(definitionId)?.baseStats.pointCost ?? 0;
}

/** Running tally of what one side has destroyed. */
export interface SideScore {
  /** Total squad-point value of enemy ships this side destroyed. */
  readonly destroyedPoints: number;
  /** Number of enemy ships destroyed (secondary tiebreak / display only). */
  readonly kills: number;
}

/** Winner of a timed-out competitive match. */
export type TimeoutOutcome = "side1" | "side2" | "draw";

/** A fresh, empty score. */
export function createSideScore(): SideScore {
  return { destroyedPoints: 0, kills: 0 };
}

/**
 * Credit a side with destroying one enemy ship of the given definition.
 * @returns A new score with the ship's point cost and a kill added.
 */
export function creditKill(score: SideScore, definitionId: string): SideScore {
  return {
    destroyedPoints: score.destroyedPoints + shipPointCost(definitionId),
    kills: score.kills + 1,
  };
}

/**
 * Decide a timed-out match by destroyed point value, then kills, else draw.
 * Mirrors the miniatures game's margin-of-victory tiebreak.
 */
export function resolveByPoints(
  side1: SideScore,
  side2: SideScore,
): TimeoutOutcome {
  if (side1.destroyedPoints !== side2.destroyedPoints) {
    return side1.destroyedPoints > side2.destroyedPoints ? "side1" : "side2";
  }
  if (side1.kills !== side2.kills) {
    return side1.kills > side2.kills ? "side1" : "side2";
  }
  return "draw";
}
