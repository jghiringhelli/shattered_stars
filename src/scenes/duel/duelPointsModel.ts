/**
 * duelPointsModel — the points strip of the Dogfight / Ace Duel setups: what
 * each side flies (hull + pilot + cards, via flownSquadCost) and a plain
 * sentence about the gap. Pure: no Phaser.
 */

import { flownSquadCost } from "../../core/squadTypes";

/** A gap of at most this many points still reads as an even duel. */
export const EVEN_GAP_POINTS = 10;

/** Who the gap favours. */
export type PointsVerdict = "even" | "up" | "down";

/** What the strip shows. */
export interface PointsStrip {
  readonly you: number;
  readonly enemy: number;
  /** Absolute points between the sides. */
  readonly gap: number;
  /** Your share of the two sides' total, 0..1 (0.5 when both are empty). */
  readonly youShare: number;
  readonly verdict: PointsVerdict;
  /** Plain-language sentence about the gap. */
  readonly caption: string;
}

/**
 * @param shipIds - The ships of one side.
 * @param loadoutIds - The chosen quick build per ship (null = default build).
 * @returns What that side costs as it flies.
 */
export function sidePoints(
  shipIds: readonly string[],
  loadoutIds: ReadonlyArray<string | null>,
): number {
  const choices: Record<string, string> = {};
  loadoutIds.forEach((id, index) => {
    if (id !== null) choices[String(index)] = id;
  });
  return flownSquadCost(shipIds, choices);
}

/**
 * @param you - Your flown points.
 * @param enemy - The enemy's flown points.
 * @returns The strip's numbers and caption.
 */
export function pointsStrip(you: number, enemy: number): PointsStrip {
  const gap = Math.abs(you - enemy);
  const total = you + enemy;
  const youShare = total > 0 ? you / total : 0.5;
  if (gap <= EVEN_GAP_POINTS) {
    return {
      you,
      enemy,
      gap,
      youShare,
      verdict: "even",
      caption: `Even duel: ${you} vs ${enemy} pt`,
    };
  }
  const up = you > enemy;
  return {
    you,
    enemy,
    gap,
    youShare,
    verdict: up ? "up" : "down",
    caption: up
      ? `You fly ${gap} pt more than the enemy`
      : `The enemy flies ${gap} pt more than you`,
  };
}
