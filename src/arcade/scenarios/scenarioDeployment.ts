/**
 * scenarioDeployment — where each side starts a scenario: on its own
 * deployment line, the player's below the centre line facing up, the
 * opponent's above it facing down (the tabletop's facing player edges),
 * flagship in the middle and the rest fanning out to both sides.
 *
 * Pure.
 */

import type { ObjectivePoint } from "../objectives";
import {
  SCENARIO_DEPLOY_OFFSET_PX,
  SCENARIO_DEPLOY_SPACING_PX,
} from "./scenarioConstants";
import type { ScenarioSide } from "./scenarioTypes";

/** Heading of a side facing up / down the board (degrees, 0 = up). */
const FACING: Readonly<Record<ScenarioSide, number>> = {
  player: 0,
  enemy: 180,
};

/** A start pose (angle in degrees, 0 = up, clockwise). */
export interface DeployPose {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/**
 * @param side - A side.
 * @param worldSize - Torus side.
 * @returns The centre of the side's deployment line (its "home").
 */
export function homePoint(
  side: ScenarioSide,
  worldSize: number,
): ObjectivePoint {
  const centre = worldSize / 2;
  const offset =
    side === "player" ? SCENARIO_DEPLOY_OFFSET_PX : -SCENARIO_DEPLOY_OFFSET_PX;
  return { x: centre, y: centre + offset };
}

/**
 * @param count - Ships on the side.
 * @param side - The side.
 * @param worldSize - Torus side.
 * @returns One start pose per ship: centre first, then alternately left and
 *   right of the ship's own heading — so the opponent's line is the
 *   player's turned half a circle about the centre (a mirrored fan-out
 *   handed one seat the pilots' left/right habits: the player seat won
 *   35 % of reinforced Salvage Missions).
 */
export function deploymentPoses(
  count: number,
  side: ScenarioSide,
  worldSize: number,
): DeployPose[] {
  const home = homePoint(side, worldSize);
  const lateral = side === "player" ? 1 : -1;
  return Array.from({ length: count }, (_, i) => {
    const step = Math.ceil(i / 2) * (i % 2 === 1 ? -1 : 1);
    return {
      x: home.x + lateral * step * SCENARIO_DEPLOY_SPACING_PX,
      y: home.y,
      angle: FACING[side],
    };
  });
}
