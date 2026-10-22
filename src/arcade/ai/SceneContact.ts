/**
 * SceneContact — a cycle-engine scene ship as the AI sees it (BotContact):
 * pose, health, primary arc and range, throttle and stress. Shared by every
 * scene whose ships carry a CycleFlightState (duels, Epic, Continuous,
 * Survival, Campaign).
 *
 * Pure: no Phaser.
 */

import type { CycleFlightState } from "../systems/CycleFlight";
import type { BotContact } from "./BotView";

/** What the AI reads from a flying scene ship. */
export interface BotShipSource {
  readonly id: string;
  readonly definitionId: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  readonly flight: CycleFlightState;
  readonly combatStats: {
    /** Full primary arc (°). */
    readonly firingArc: number;
    /** Primary range (px). */
    readonly weaponRange: number;
  };
}

/**
 * @param ship - A scene ship.
 * @param side - The side it flies for (allies share it).
 * @returns The ship as a BotContact.
 */
export function botContactOf(ship: BotShipSource, side: string): BotContact {
  return {
    id: ship.id,
    side,
    definitionId: ship.definitionId,
    x: ship.x,
    y: ship.y,
    angle: ship.angle,
    alive: ship.hull > 0,
    hull: ship.hull,
    maxHull: ship.maxHull,
    shields: ship.shields,
    maxShields: ship.maxShields,
    firingArcDeg: ship.combatStats.firingArc,
    weaponRange: ship.combatStats.weaponRange,
    speed: ship.flight.motion.control.cycleSpeed,
    isStressed: ship.flight.stress.isStressed,
  };
}
