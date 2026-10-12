import { describe, expect, it } from "vitest";
import {
  SCENARIO_DEFINITIONS,
  SCENARIO_DEPLOY_OFFSET_PX,
  SCENARIO_DEPLOY_SPACING_PX,
  SCENARIO_IDS,
  deploymentPoses,
  homePoint,
} from "../../../../src/arcade/scenarios";

const WORLD = 6000;
const C = WORLD / 2;

describe("deploymentPoses", () => {
  it("the player's side deploys on its line below the centre, facing up", () => {
    const poses = deploymentPoses(3, "player", WORLD);
    expect(
      poses.every(
        (p) => p.y === C + SCENARIO_DEPLOY_OFFSET_PX && p.angle === 0,
      ),
    ).toBe(true);
  });

  it("the opponent deploys on the far line, facing down", () => {
    const poses = deploymentPoses(2, "enemy", WORLD);
    expect(
      poses.every(
        (p) => p.y === C - SCENARIO_DEPLOY_OFFSET_PX && p.angle === 180,
      ),
    ).toBe(true);
  });

  it("the first ship (the flagship) takes the centre and the rest fan out", () => {
    const xs = deploymentPoses(4, "player", WORLD).map((p) => p.x);
    expect(xs).toEqual([
      C,
      C - SCENARIO_DEPLOY_SPACING_PX,
      C + SCENARIO_DEPLOY_SPACING_PX,
      C - 2 * SCENARIO_DEPLOY_SPACING_PX,
    ]);
  });

  it("deploys the opponent as the player's line turned half a circle about the centre (no seat favoured)", () => {
    const player = deploymentPoses(5, "player", WORLD);
    const enemy = deploymentPoses(5, "enemy", WORLD);
    enemy.forEach((pose, i) => {
      expect(pose.x).toBeCloseTo(WORLD - player[i]!.x, 9);
      expect(pose.y).toBeCloseTo(WORLD - player[i]!.y, 9);
      expect(pose.angle).toBe((player[i]!.angle + 180) % 360);
    });
  });
});

describe("scenario layouts", () => {
  it.each(SCENARIO_IDS)(
    "%s places its objectives point-symmetric about the centre (each seat sees the same board)",
    (id) => {
      const slots = SCENARIO_DEFINITIONS[id].slots;
      for (const slot of slots)
        expect(
          slots.some(
            (other) =>
              Math.abs(other.dx + slot.dx) < 1e-9 &&
              Math.abs(other.dy + slot.dy) < 1e-9,
          ),
        ).toBe(true);
    },
  );
});

describe("homePoint", () => {
  it("is the centre of the side's deployment line", () => {
    expect(homePoint("player", WORLD)).toEqual({
      x: C,
      y: C + SCENARIO_DEPLOY_OFFSET_PX,
    });
    expect(homePoint("enemy", WORLD)).toEqual({
      x: C,
      y: C - SCENARIO_DEPLOY_OFFSET_PX,
    });
  });
});
