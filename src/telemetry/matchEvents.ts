/**
 * matchEvents — builders for match-telemetry events, so a battle scene
 * records each in one line: `matchStats.record(projectileShot(proj, side))`.
 * Pure data.
 */

import type { ManeuverDefinition } from "../core/types";
import type { CompletedCycle } from "../arcade/systems/ShipMotion";
import type { MatchStatEvent } from "./matchStatTypes";

/** The projectile fields a shot record reads. */
export interface ShotProjectile {
  readonly ownerFaction: string;
  readonly isLaser?: boolean | undefined;
}

/**
 * @param projectile - A projectile just spawned (it resolves later).
 * @param playerFaction - The player's side.
 * @returns Its unresolved shot, under the weapon its impact is tallied as
 *   (laser bolts primary; turret orbs, beams and ordnance "ordnance").
 */
export function projectileShot(
  projectile: ShotProjectile,
  playerFaction: string,
): MatchStatEvent {
  return {
    kind: "shot",
    friendly: projectile.ownerFaction === playerFaction,
    weapon: projectile.isLaser ? "primary" : "ordnance",
    hit: false,
  };
}

/**
 * @param stress - The player's stress after this frame's flight.
 * @param ms - The frame's length (ms).
 * @returns The frame's stress record.
 */
export function stressEvent(
  stress: { readonly isStressed: boolean },
  ms: number,
): MatchStatEvent {
  return { kind: "stress", ms, stressed: stress.isStressed };
}

/**
 * @param dial - The player ship's dial.
 * @param completed - The cycle it just committed.
 * @returns The cycle record (dial difficulty is classified by the summary).
 */
export function cycleEvent(
  dial: readonly ManeuverDefinition[],
  completed: CompletedCycle,
): MatchStatEvent {
  return {
    kind: "cycle",
    dial,
    direction: completed.direction,
    speed: completed.speed,
  };
}
