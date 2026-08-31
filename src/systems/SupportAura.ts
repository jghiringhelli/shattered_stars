/**
 * Support-ship aura resolution.
 *
 * Pure, framework-free logic shared by the arcade scene (per-frame effect
 * application) and headless uptime telemetry. A support ship projects a
 * circular aura that shields-regenerates and marks as "covered" every allied
 * ship within {@link SupportAuraParams.radius}.
 *
 * The radius is a tunable named constant: it is deliberately small enough that
 * a lone escorted ally sits inside it only while the support ship actively
 * anchors on it (~65-70% of the time under default wander), while a skilled
 * player herding a swarm can push coverage toward 100%.
 */

import type { FactionId } from "../config";
import type { ShipRole } from "../core/types";

/** Minimal ship shape needed to resolve auras (no Phaser/runtime coupling). */
export interface AuraShip {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly faction: FactionId;
  readonly role: ShipRole;
  readonly hull: number;
  readonly shields: number;
  readonly maxShields: number;
}

/** Tunable aura parameters. */
export interface SupportAuraParams {
  /** Coverage radius in pixels. */
  readonly radius: number;
  /** Shield points regenerated per second for covered allies. */
  readonly shieldRegenPerSecond: number;
}

/** Result of resolving all support auras for a single tick. */
export interface AuraResult {
  /** Ship id -> shield points to add this tick (already capped at maxShields). */
  readonly shieldGain: ReadonlyMap<string, number>;
  /** Ids of allied ships inside at least one support aura this tick. */
  readonly coveredShipIds: ReadonlySet<string>;
}

/** Default aura radius (pixels). Tuned for ~65-70% lone-ally uptime. */
export const AURA_RADIUS_DEFAULT = 320;

/** Default shield regeneration rate for covered allies (points/second). */
export const AURA_SHIELD_REGEN_PER_SECOND = 0.5;

/** Default aura parameter bundle. */
export const DEFAULT_AURA_PARAMS: SupportAuraParams = {
  radius: AURA_RADIUS_DEFAULT,
  shieldRegenPerSecond: AURA_SHIELD_REGEN_PER_SECOND,
};

/**
 * Squared distance between two points (avoids a sqrt in the hot loop).
 * @param ax - First point x.
 * @param ay - First point y.
 * @param bx - Second point x.
 * @param by - Second point y.
 * @returns The squared Euclidean distance.
 */
function distanceSquared(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * Determine whether a ship can act as an aura source this tick.
 * @param ship - Candidate ship.
 * @returns True for living support-role ships.
 */
function isActiveSource(ship: AuraShip): boolean {
  return ship.role === "support" && ship.hull > 0;
}

/**
 * Resolve every support aura against the current ship set for one tick.
 *
 * @param ships - All ships in play (players + allies + enemies).
 * @param deltaMs - Elapsed simulation time for this tick, in milliseconds.
 * @param params - Tunable aura parameters.
 * @returns Per-ship shield gain and the set of allies under coverage.
 */
export function resolveSupportAuras(
  ships: ReadonlyArray<AuraShip>,
  deltaMs: number,
  params: SupportAuraParams = DEFAULT_AURA_PARAMS,
): AuraResult {
  const shieldGain = new Map<string, number>();
  const coveredShipIds = new Set<string>();
  const radiusSquared = params.radius * params.radius;
  const regenThisTick = (params.shieldRegenPerSecond * deltaMs) / 1000;

  const sources = ships.filter(isActiveSource);
  if (sources.length === 0) {
    return { shieldGain, coveredShipIds };
  }

  for (const ally of ships) {
    if (ally.hull <= 0) continue;
    const covered = sources.some(
      (source) =>
        source.id !== ally.id &&
        source.faction === ally.faction &&
        distanceSquared(source.x, source.y, ally.x, ally.y) <= radiusSquared,
    );
    if (!covered) continue;

    coveredShipIds.add(ally.id);
    const room = ally.maxShields - ally.shields;
    if (room > 0) {
      shieldGain.set(ally.id, Math.min(room, regenThisTick));
    }
  }

  return { shieldGain, coveredShipIds };
}
