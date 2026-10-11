/**
 * Shared fixtures for the arcade AI tests: scene-style contacts and flights.
 */

import type { BotContact } from "../../../../src/arcade/ai/BotView";
import {
  createCycleFlight,
  type CycleFlightState,
} from "../../../../src/arcade/systems/CycleFlight";
import { getModeCombatStats } from "../../../../src/data/ModeBalancing";

/** A ship as a scene would describe it to the AI. */
export function contact(
  id: string,
  side: string,
  definitionId: string,
  pose: { x: number; y: number; angle: number },
  overrides: Partial<BotContact> = {},
): BotContact {
  const stats = getModeCombatStats(definitionId, "continuous");
  return {
    id,
    side,
    definitionId,
    ...pose,
    alive: true,
    hull: stats.hull,
    maxHull: stats.maxHull,
    shields: stats.shields,
    maxShields: stats.maxShields,
    firingArcDeg: stats.firingArc,
    weaponRange: stats.weaponRange,
    ...overrides,
  };
}

/** A fresh flight at a contact's pose. */
export function flightOf(ship: BotContact): CycleFlightState {
  return createCycleFlight(ship.definitionId, {
    x: ship.x,
    y: ship.y,
    angle: ship.angle,
  });
}
