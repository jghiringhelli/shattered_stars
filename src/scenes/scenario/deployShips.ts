/**
 * deployShips — puts a Skirmish fleet on the scenario's deployment lines.
 * A ship's first maneuver starts at spawn (createControlState), with its
 * path in absolute coordinates, so moving a ship means restarting that
 * maneuver from the new pose — otherwise the cycle engine snaps it back.
 *
 * Pure: no Phaser (mutates the given ship records).
 */

import { deploymentPoses, type ScenarioSide } from "../../arcade/scenarios";
import {
  startManeuver,
  type ShipControlState,
} from "../../core/ArcadeControls";

/** A ship record that can be redeployed. */
export interface DeployableShip {
  x: number;
  y: number;
  angle: number;
  control: ShipControlState;
}

/**
 * @param ships - Every ship (mutated: pose and first maneuver).
 * @param sideOf - Each ship's scenario side.
 * @param worldSize - Torus side length.
 */
export function deployShips<T extends DeployableShip>(
  ships: readonly T[],
  sideOf: (ship: T) => ScenarioSide,
  worldSize: number,
): void {
  for (const side of ["player", "enemy"] as const) {
    const own = ships.filter((ship) => sideOf(ship) === side);
    const poses = deploymentPoses(own.length, side, worldSize);
    own.forEach((ship, i) => {
      const pose = poses[i]!;
      ship.x = pose.x;
      ship.y = pose.y;
      ship.angle = pose.angle;
      ship.control = startManeuver(
        pose,
        ship.control,
        ship.control.currentManeuver ?? "straight",
      );
    });
  }
}
