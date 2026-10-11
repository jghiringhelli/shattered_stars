/**
 * duelSimShips — ships for the headless duel tempo simulation, built the way
 * the Dogfight / Ace Duel scenes build theirs: continuous-mode combat stats
 * (x DURABILITY_SCALE), the default quick build equipped, cycle-engine flight.
 */

import { BATTLEFIELD_SIZE } from "../config";
import {
  createCycleFlight,
  type CycleFlightState,
} from "../arcade/systems/CycleFlight";
import {
  assignQuickBuilds,
  equipFlight,
  equipQuickBuild,
} from "../arcade/systems/QuickBuildEquip";
import type { CombatModifiers } from "../core/CombatModifiers";
import { NEUTRAL_MODIFIERS } from "../core/CombatModifiers";
import type { ManeuverDefinition } from "../core/types";
import {
  getModeCombatStats,
  type ModeCombatStats,
} from "../data/ModeBalancing";
import { getShipDial } from "../data/ShipDefinitions";

/** Distance (px) from the battlefield centre at which each side spawns (as in the scenes). */
const SPAWN_DISTANCE = 200;
/** Gap (px) between ships of the same side at spawn (as in Ace Duel). */
const SPAWN_SPACING = 60;
/** Side 1 faces north (0°), side 2 faces south. */
const SIDE_HEADING_DEG: Readonly<Record<1 | 2, number>> = { 1: 0, 2: 180 };

/** A simulated duel ship (mutable, like the scenes' ship records). */
export interface DuelSimShip {
  readonly id: string;
  readonly definitionId: string;
  readonly side: 1 | 2;
  x: number;
  y: number;
  angle: number;
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;
  readonly combatStats: ModeCombatStats;
  flight: CycleFlightState;
  readonly dial: readonly ManeuverDefinition[];
  weaponCooldown: number;
  modifiers: CombatModifiers;
  frenzyUntilMs: number;
}

/**
 * Spawn one side in a line facing the other, each ship on its default
 * quick build (no unique pilot repeated within the side).
 *
 * @param side - Which side.
 * @param shipIds - Ship definition ids.
 * @returns The side's ships.
 */
export function spawnDuelSide(
  side: 1 | 2,
  shipIds: readonly string[],
): DuelSimShip[] {
  const center = BATTLEFIELD_SIZE / 2;
  const y = center + (side === 1 ? SPAWN_DISTANCE : -SPAWN_DISTANCE);
  const loadouts = assignQuickBuilds(shipIds);
  const lastIndex = shipIds.length - 1;
  return shipIds.map((definitionId, index) =>
    buildShip({
      id: `side${side}_${index}`,
      definitionId,
      side,
      x: center + (index - lastIndex / 2) * SPAWN_SPACING,
      y,
      loadoutId: loadouts[index] ?? null,
    }),
  );
}

interface ShipSpec {
  readonly id: string;
  readonly definitionId: string;
  readonly side: 1 | 2;
  readonly x: number;
  readonly y: number;
  readonly loadoutId: string | null;
}

function buildShip(spec: ShipSpec): DuelSimShip {
  const combatStats = getModeCombatStats(spec.definitionId, "continuous");
  const angle = SIDE_HEADING_DEG[spec.side];
  const pose = { x: spec.x, y: spec.y, angle };
  const ship: DuelSimShip = {
    id: spec.id,
    definitionId: spec.definitionId,
    side: spec.side,
    ...pose,
    hull: combatStats.hull,
    maxHull: combatStats.maxHull,
    shields: combatStats.shields,
    maxShields: combatStats.maxShields,
    combatStats,
    flight: createCycleFlight(spec.definitionId, pose),
    dial: getShipDial(spec.definitionId),
    weaponCooldown: 0,
    modifiers: NEUTRAL_MODIFIERS,
    frenzyUntilMs: 0,
  };
  ship.modifiers = equipQuickBuild(ship, spec.loadoutId);
  ship.flight = equipFlight(ship.flight, ship.modifiers);
  return ship;
}
