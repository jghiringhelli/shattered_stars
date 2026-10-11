/**
 * frameBuilder — test data builder for objective frames and ships.
 */

import type {
  ObjectiveEvent,
  ObjectiveFrame,
  ObjectiveShip,
} from "../../../../src/arcade/objectives/objectiveTypes";

/** World size used by objective specs (a plane: no wrap surprises). */
export const TEST_WORLD = 6000;

/**
 * @param id - Ship id.
 * @param overrides - Fields to change from a small, healthy player ship.
 * @returns An objective ship.
 */
export function ship(
  id: string,
  overrides: Partial<ObjectiveShip> = {},
): ObjectiveShip {
  return {
    id,
    side: "player",
    x: 0,
    y: 0,
    hull: 100,
    maxHull: 100,
    weight: 1,
    tags: [],
    stressed: false,
    ...overrides,
  };
}

/**
 * @param shipId - Destroyed ship.
 * @param side - Its side.
 * @param tags - Its tags.
 * @returns A destroyed event at the origin.
 */
export function destroyed(
  shipId: string,
  side: "player" | "enemy" = "enemy",
  tags: readonly string[] = [],
): ObjectiveEvent {
  return { kind: "destroyed", shipId, side, tags, x: 0, y: 0 };
}

/**
 * @param overrides - Fields to change from an empty 16 ms frame at t=0.
 * @returns An objective frame.
 */
export function frame(overrides: Partial<ObjectiveFrame> = {}): ObjectiveFrame {
  return {
    elapsedMs: 0,
    deltaMs: 16,
    worldSize: TEST_WORLD,
    ships: [ship("flag")],
    events: [],
    flagshipId: "flag",
    ...overrides,
  };
}
