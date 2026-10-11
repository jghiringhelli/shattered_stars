/**
 * Test data builders for the Scenario mode rules.
 */

import type {
  ScenarioEvent,
  ScenarioFrame,
  ScenarioShip,
  ScenarioSide,
} from "../../../../src/arcade/scenarios";

/** Overrides for {@link aShip}. */
export interface ShipOverrides {
  readonly id?: string;
  readonly side?: ScenarioSide;
  readonly x?: number;
  readonly y?: number;
  readonly weight?: number;
  readonly stressed?: boolean;
  readonly value?: number;
  readonly healthFraction?: number;
}

/**
 * @param overrides - Fields that matter to the test.
 * @returns A small, healthy, unstressed player ship at the origin, worth 4.
 */
export function aShip(overrides: ShipOverrides = {}): ScenarioShip {
  return {
    id: overrides.id ?? "p1",
    side: overrides.side ?? "player",
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    hull: 10,
    maxHull: 10,
    weight: overrides.weight ?? 1,
    tags: [],
    stressed: overrides.stressed ?? false,
    value: overrides.value ?? 4,
    healthFraction: overrides.healthFraction ?? 1,
  };
}

/**
 * @param ships - Living ships.
 * @param events - Events this frame.
 * @param deltaMs - Frame length.
 * @returns A frame on a plane (no wrap) unless worldSize is given.
 */
export function aFrame(
  ships: readonly ScenarioShip[],
  events: readonly ScenarioEvent[] = [],
  deltaMs = 16,
  worldSize = 0,
): ScenarioFrame {
  return { ships, events, deltaMs, worldSize };
}
