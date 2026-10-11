import { describe, expect, it } from "vitest";
import {
  DEPLOY_EDGE_OFFSET_PX,
  DEPLOY_SPACING_PX,
  deployPose,
  sideHome,
} from "../../../../src/arcade/reinforcements/deployPoints";
import { ArrivalShield } from "../../../../src/arcade/reinforcements/arrivalShield";

const WORLD = 6000;
const C = WORLD / 2;

describe("deploy edges", () => {
  it("the player's side warps in below the centre, facing up", () => {
    const home = sideHome(0, 2, WORLD);
    expect(home.x).toBeCloseTo(C);
    expect(home.y).toBeCloseTo(C + DEPLOY_EDGE_OFFSET_PX);
    expect(home.angle).toBeCloseTo(0);
  });

  it("the opponent warps in above the centre, facing down", () => {
    const home = sideHome(1, 2, WORLD);
    expect(home.x).toBeCloseTo(C);
    expect(home.y).toBeCloseTo(C - DEPLOY_EDGE_OFFSET_PX);
    expect(home.angle).toBeCloseTo(180);
  });

  it("more sides spread evenly around the centre, all facing it", () => {
    const homes = [0, 1, 2].map((i) => sideHome(i, 3, WORLD));
    for (const home of homes)
      expect(Math.hypot(home.x - C, home.y - C)).toBeCloseTo(
        DEPLOY_EDGE_OFFSET_PX,
      );
    expect(homes[1]!.angle).toBeCloseTo(120);
  });

  it("successive deployments fan out across the edge", () => {
    const home = sideHome(0, 2, WORLD);
    const xs = [0, 1, 2].map((slot) => deployPose(home, slot).x - C);
    expect(xs[0]).toBeCloseTo(0);
    expect(Math.abs(xs[1]!)).toBeCloseTo(DEPLOY_SPACING_PX);
    expect(xs[2]).toBeCloseTo(-xs[1]!);
    expect(deployPose(home, 1).y).toBeCloseTo(home.y);
  });
});

describe("arrival shield", () => {
  it("protects a new ship until its shield expires", () => {
    const shield = new ArrivalShield();
    shield.protect("a", 1000, 500);
    expect(shield.isProtected("a", 1200)).toBe(true);
    expect(shield.isProtected("a", 1500)).toBe(false);
    expect(shield.isProtected("b", 1200)).toBe(false);
  });

  it("forgets ships and clears", () => {
    const shield = new ArrivalShield();
    shield.protect("a", 0, 500);
    shield.forget("a");
    expect(shield.isProtected("a", 1)).toBe(false);
    shield.protect("b", 0, 500);
    shield.clear();
    expect(shield.isProtected("b", 1)).toBe(false);
  });
});
