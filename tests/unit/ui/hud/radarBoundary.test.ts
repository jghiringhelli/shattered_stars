/**
 * radarBoundary — the arena's safe radius (Survival's asteroid belt) as
 * polylines on the heading-up radar.
 */

import { describe, it, expect } from "vitest";
import { radarBoundaryPaths } from "../../../../src/ui/hud/radarBoundary";

const OPTIONS = { rangePx: 2000, radiusPx: 80, worldSize: 6000 };
const CENTER = { x: 3000, y: 3000 };

function allPoints(paths: ReturnType<typeof radarBoundaryPaths>) {
  return paths.flat();
}

describe("radarBoundaryPaths", () => {
  it("draws nothing while the boundary is beyond radar range", () => {
    const player = { x: 3000, y: 3000, angle: 0 };
    expect(
      radarBoundaryPaths(player, { center: CENTER, radius: 2600 }, OPTIONS),
    ).toEqual([]);
  });

  it("draws the whole ring when it fits inside the radar", () => {
    const player = { x: 3000, y: 3000, angle: 0 };
    const paths = radarBoundaryPaths(
      player,
      { center: CENTER, radius: 1000 },
      OPTIONS,
    );
    const points = allPoints(paths);
    expect(points.length).toBeGreaterThan(16);
    for (const p of points) expect(Math.hypot(p.x, p.y)).toBeCloseTo(40, 5);
  });

  it("keeps every drawn point inside the radar disc", () => {
    const player = { x: 3000, y: 3000 - 2400, angle: 37 };
    const paths = radarBoundaryPaths(
      player,
      { center: CENTER, radius: 2600 },
      OPTIONS,
    );
    expect(paths.length).toBeGreaterThan(0);
    for (const p of allPoints(paths))
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(OPTIONS.radiusPx + 1e-9);
  });

  it("shows the ring ahead when the player flies toward the belt (heading up)", () => {
    // Player 2 400 px north of the centre, facing north: the ring is 200 px ahead.
    const player = { x: 3000, y: 3000 - 2400, angle: 0 };
    const paths = radarBoundaryPaths(
      player,
      { center: CENTER, radius: 2600 },
      OPTIONS,
    );
    const nearest = allPoints(paths).reduce((a, b) =>
      Math.hypot(a.x, a.y) < Math.hypot(b.x, b.y) ? a : b,
    );
    expect(nearest.y).toBeLessThan(0);
    expect(Math.hypot(nearest.x, nearest.y)).toBeCloseTo((200 / 2000) * 80, 0);
  });
});
