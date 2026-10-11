/**
 * ArenaLayout — seeded spawn poses: the two sides start as facing lines
 * across a random axis, each ship with its own heading jitter, so over many
 * seeds neither side gets a systematic positional edge.
 *
 * Pure: no Phaser.
 */

import type { Pose } from "../../arcade/ai/BotTypes";

/** Separation range between the two lines for a duel (px). */
export const DUEL_SEPARATION_PX = { min: 500, max: 900 } as const;

/** Separation range between the two lines for squads (px). */
export const SQUAD_SEPARATION_PX = { min: 1100, max: 1500 } as const;

/** Lateral spacing between ships of one line (px). */
export const LINE_SPACING_PX = 160;

/** Max heading jitter off "facing the enemy line" (±°). */
export const SPAWN_HEADING_JITTER_DEG = 45;

/** Spawn poses for both sides. */
export interface SpawnLayout {
  readonly A: readonly Pose[];
  readonly B: readonly Pose[];
}

/**
 * @param countA - Ships on side A.
 * @param countB - Ships on side B.
 * @param worldSize - Battlefield edge (px).
 * @param random - Seeded uniform source in [0, 1).
 * @returns One pose per ship, lines facing each other.
 */
export function spawnLayout(
  countA: number,
  countB: number,
  worldSize: number,
  random: () => number,
): SpawnLayout {
  const range =
    Math.max(countA, countB) > 1 ? SQUAD_SEPARATION_PX : DUEL_SEPARATION_PX;
  const separation = range.min + random() * (range.max - range.min);
  const axisRad = random() * Math.PI * 2;
  const ux = Math.sin(axisRad);
  const uy = -Math.cos(axisRad);
  const centre = worldSize / 2;
  const facingA = (axisRad * 180) / Math.PI;
  const line = (count: number, sign: number, facing: number): Pose[] =>
    Array.from({ length: count }, (_, index) => {
      const lateral = (index - (count - 1) / 2) * LINE_SPACING_PX;
      const jitter = (random() * 2 - 1) * SPAWN_HEADING_JITTER_DEG;
      return {
        x: centre + sign * ux * (separation / 2) - uy * lateral,
        y: centre + sign * uy * (separation / 2) + ux * lateral,
        angle: (((facing + jitter) % 360) + 360) % 360,
      };
    });
  return { A: line(countA, -1, facingA), B: line(countB, 1, facingA + 180) };
}
