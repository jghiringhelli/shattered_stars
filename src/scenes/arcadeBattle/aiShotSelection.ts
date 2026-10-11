/**
 * aiShotSelection — which enemy an AI Skirmish ship spends an attack on.
 *
 * The bot pilot names the enemy it is after (BotPilot.targetId, else its
 * squad's focus); the ship shoots that one whenever it has a firing
 * solution, and otherwise any other enemy it has a solution on (the
 * nearest), as a pilot takes the shot in front of it. Ordnance goes only at
 * the pilot's target, when it is inside the launch cone and reach.
 *
 * Pure: no Phaser.
 */

import { torusDelta } from "../../core/Torus";
import {
  aiFiringSolution,
  leadIntercept,
  type FiringBody,
  type FiringEnvelope,
} from "./aiFiringSolution";
import { bearingDeg, headingGapDeg } from "./arcTargeting";

/** Half-width of the cone (° off the nose) inside which the AI launches ordnance. */
export const AI_ORDNANCE_CONE_DEG = 45;
/** Farthest target the AI launches ordnance at (px). */
export const AI_MAX_ORDNANCE_RANGE_PX = 1500;

/** A ship the AI may shoot at. */
export interface ShotCandidate extends FiringBody {
  readonly id: string;
}

/** The AI's chosen laser shot. */
export interface AiShot<T extends ShotCandidate> {
  readonly target: T;
  /** Bolt heading (°): the lead-intercept bearing. */
  readonly aim: number;
}

/**
 * @param shooter - The firing ship.
 * @param candidates - Enemies it may shoot (alive, not immune to it).
 * @param preferredId - The pilot's target, tried first.
 * @param envelope - Bolt speed, world size, cone and range.
 * @returns The preferred target's shot if it has one, else the nearest
 *   other candidate with a firing solution, else null (hold fire).
 */
export function pickAiShot<T extends ShotCandidate>(
  shooter: FiringBody,
  candidates: readonly T[],
  preferredId: string | null,
  envelope: FiringEnvelope,
): AiShot<T> | null {
  const preferred = candidates.find((c) => c.id === preferredId);
  if (preferred) {
    const aim = aiFiringSolution(shooter, preferred, envelope);
    if (aim !== null) return { target: preferred, aim };
  }
  let best: AiShot<T> | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (candidate === preferred) continue;
    const aim = aiFiringSolution(shooter, candidate, envelope);
    if (aim === null) continue;
    const { distance } = leadIntercept(shooter, candidate, envelope);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { target: candidate, aim };
    }
  }
  return best;
}

/**
 * @param shooter - The launching ship.
 * @param target - The pilot's target.
 * @param worldSize - Torus side length (px).
 * @returns Whether the target is inside the ordnance cone and reach.
 */
export function ordnanceInReach(
  shooter: { readonly x: number; readonly y: number; readonly angle: number },
  target: { readonly x: number; readonly y: number },
  worldSize: number,
): boolean {
  const { dx, dy } = torusDelta(
    shooter.x,
    shooter.y,
    target.x,
    target.y,
    worldSize,
  );
  if (Math.hypot(dx, dy) >= AI_MAX_ORDNANCE_RANGE_PX) return false;
  return (
    headingGapDeg(bearingDeg(dx, dy), shooter.angle) < AI_ORDNANCE_CONE_DEG
  );
}
