/**
 * controlRules — X-Wing 2.0 objective control in real time: a side controls
 * an objective while it has more ship weight within control range than the
 * other (medium and bigger ships count double; equal weight = contested).
 * Wraps the mission objectives' zoneController so both modes resolve
 * control identically.
 *
 * Pure.
 */

import type { ShipSize } from "../../config";
import {
  zoneController,
  type ObjectiveFrame,
  type ObjectivePoint,
  type ObjectiveShip,
} from "../objectives";
import { SCENARIO_TUNING } from "./scenarioConstants";
import type {
  ControlZone,
  ObjectiveOwner,
  ScenarioFrame,
  ScenarioSide,
} from "./scenarioTypes";

/**
 * @param size - A ship's base size.
 * @returns Its control weight: 1 tiny/small, 2 medium or bigger.
 */
export function controlWeight(size: ShipSize): number {
  return size === "tiny" || size === "small"
    ? SCENARIO_TUNING.smallControlWeight
    : SCENARIO_TUNING.largeControlWeight;
}

/**
 * @param ships - Living ships.
 * @param at - Objective centre.
 * @param radius - Control range (px).
 * @param worldSize - Torus side (<= 0 for a plane).
 * @returns Who controls the objective.
 */
export function resolveControl(
  ships: readonly ObjectiveShip[],
  at: ObjectivePoint,
  radius: number,
  worldSize: number,
): ObjectiveOwner {
  const frame: ObjectiveFrame = {
    elapsedMs: 0,
    deltaMs: 0,
    worldSize,
    ships,
    events: [],
    flagshipId: null,
  };
  return zoneController(frame, at, radius);
}

/**
 * @param zones - Control objectives.
 * @param frame - This frame.
 * @returns The zones with this frame's controllers.
 */
export function stepControlZones(
  zones: readonly ControlZone[],
  frame: ScenarioFrame,
): ControlZone[] {
  return zones.map((zone) => ({
    ...zone,
    controller: resolveControl(frame.ships, zone, zone.radius, frame.worldSize),
  }));
}

/**
 * @param zones - Control objectives.
 * @param side - A side.
 * @returns How many of them the side controls.
 */
export function zonesHeldBy(
  zones: readonly ControlZone[],
  side: ScenarioSide,
): number {
  return zones.filter((zone) => zone.controller === side).length;
}
