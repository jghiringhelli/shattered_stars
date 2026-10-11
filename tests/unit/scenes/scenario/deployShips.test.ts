import { describe, expect, it } from "vitest";
import { homePoint } from "../../../../src/arcade/scenarios";
import { createControlState } from "../../../../src/core/ArcadeControls";
import { stepMotion } from "../../../../src/arcade/systems/ShipMotion";
import {
  deployShips,
  type DeployableShip,
} from "../../../../src/scenes/scenario/deployShips";

const WORLD = 6000;

function shipAt(
  x: number,
  y: number,
  side: "player" | "enemy",
): DeployableShip & { side: string } {
  const pose = { x, y, angle: 0 };
  return { ...pose, side, control: createControlState(pose, 32) };
}

describe("deployShips", () => {
  it("moves each side onto its deployment line, facing the other", () => {
    const ships = [shipAt(10, 10, "player"), shipAt(20, 20, "enemy")];
    deployShips(ships, (s) => s.side as "player" | "enemy", WORLD);
    expect(ships[0]).toMatchObject({ ...homePoint("player", WORLD), angle: 0 });
    expect(ships[1]).toMatchObject({
      ...homePoint("enemy", WORLD),
      angle: 180,
    });
  });

  it("the cycle engine flies the ship on from its new pose, not back at spawn", () => {
    const ship = shipAt(10, 10, "player");
    deployShips([ship], () => "player", WORLD);
    const step = stepMotion(ship, ship, 100, WORLD);
    const home = homePoint("player", WORLD);
    expect(
      Math.hypot(step.state.x - home.x, step.state.y - home.y),
    ).toBeLessThan(100);
  });
});
