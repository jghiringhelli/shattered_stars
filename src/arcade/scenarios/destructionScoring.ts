/**
 * destructionScoring — tabletop's destroyed-ship points, adapted: every
 * ship is worth its squad cost in scenario points (a full standard list is
 * worth the threshold); a ship at half health or below concedes half its
 * value (rounded up) once, and its destruction concedes the rest.
 *
 * Pure.
 */

import {
  HALF_POINTS_HEALTH_FRACTION,
  MIN_SHIP_SCENARIO_VALUE,
  SCENARIO_TUNING,
} from "./scenarioConstants";
import type { ScenarioFrame, ScenarioSide } from "./scenarioTypes";

/** Points scored this frame and the ships that have conceded half. */
export interface DestructionStep {
  readonly halfAwarded: ReadonlySet<string>;
  readonly awards: Readonly<Record<ScenarioSide, number>>;
}

/**
 * @param pointCost - A ship's squad cost.
 * @param pointsPerSquadPoint - Scenario points per squad point.
 * @returns What destroying it is worth (scenario points).
 */
export function scenarioShipValue(
  pointCost: number,
  pointsPerSquadPoint: number = SCENARIO_TUNING.pointsPerSquadPoint,
): number {
  return Math.max(
    MIN_SHIP_SCENARIO_VALUE,
    Math.round(pointCost * pointsPerSquadPoint),
  );
}

/**
 * @param value - A ship's scenario value.
 * @returns What it concedes at half health (half, rounded up).
 */
export function halfValue(value: number): number {
  return Math.ceil(value / 2);
}

/**
 * @param side - A side.
 * @returns The other side.
 */
export function opponentOf(side: ScenarioSide): ScenarioSide {
  return side === "player" ? "enemy" : "player";
}

/**
 * Score this frame's damage and destruction.
 *
 * @param halfAwarded - Ships that already conceded half their value.
 * @param frame - This frame (living ships and destroyed events).
 * @returns Updated ledger and the points each side scored.
 */
export function scoreDestruction(
  halfAwarded: ReadonlySet<string>,
  frame: ScenarioFrame,
): DestructionStep {
  const ledger = new Set(halfAwarded);
  const awards = { player: 0, enemy: 0 };
  for (const ship of frame.ships) {
    if (ledger.has(ship.id)) continue;
    if (ship.healthFraction > HALF_POINTS_HEALTH_FRACTION) continue;
    ledger.add(ship.id);
    awards[opponentOf(ship.side)] += halfValue(ship.value);
  }
  for (const event of frame.events) {
    if (event.kind !== "destroyed") continue;
    const conceded = ledger.has(event.shipId) ? halfValue(event.value) : 0;
    ledger.add(event.shipId);
    awards[opponentOf(event.side)] += event.value - conceded;
  }
  return { halfAwarded: ledger, awards };
}
