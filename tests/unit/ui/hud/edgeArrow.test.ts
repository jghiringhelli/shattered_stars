/**
 * Spec: off-screen ship arrows sit on an inset track at the screen edge,
 * point at the ship, and disappear when the ship is on screen.
 */

import { describe, it, expect } from "vitest";
import {
  placeEdgeArrow,
  type EdgeInsets,
} from "../../../../src/ui/hud/hudMath";
import type { CameraViewSnapshot } from "../../../../src/ui/hud/types";

const WORLD = 6000;
const PRECISION = 9;
const W = 1280;
const H = 720;
const INSET = 20;
const insets: EdgeInsets = {
  top: INSET,
  right: INSET,
  bottom: INSET,
  left: INSET,
};
const NO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function view(centerX: number, centerY: number, zoom = 1): CameraViewSnapshot {
  return { centerX, centerY, zoom, width: W, height: H };
}

describe("placeEdgeArrow — visibility", () => {
  it("returns null for a ship at the view centre", () => {
    expect(
      placeEdgeArrow(view(1000, 1000), { x: 1000, y: 1000 }, insets, WORLD),
    ).toBeNull();
  });

  it("treats points exactly on each screen edge as on screen", () => {
    const v = view(1000, 1000);
    expect(
      placeEdgeArrow(v, { x: 1000 + W / 2, y: 1000 }, insets, WORLD),
    ).toBeNull();
    expect(
      placeEdgeArrow(v, { x: 1000 - W / 2, y: 1000 }, insets, WORLD),
    ).toBeNull();
    expect(
      placeEdgeArrow(v, { x: 1000, y: 1000 + H / 2 }, insets, WORLD),
    ).toBeNull();
    expect(
      placeEdgeArrow(v, { x: 1000, y: 1000 - H / 2 }, insets, WORLD),
    ).toBeNull();
  });

  it("treats the exact screen corner as on screen", () => {
    expect(
      placeEdgeArrow(
        view(1000, 1000),
        { x: 1000 + W / 2, y: 1000 + H / 2 },
        insets,
        WORLD,
      ),
    ).toBeNull();
  });

  it("depends on zoom: on screen at 1x, off screen at 2x", () => {
    const target = { x: 1400, y: 1000 };
    expect(
      placeEdgeArrow(view(1000, 1000, 1), target, insets, WORLD),
    ).toBeNull();
    expect(
      placeEdgeArrow(view(1000, 1000, 2), target, insets, WORLD),
    ).not.toBeNull();
  });

  it.each([
    { zoom: 0, width: W, height: H },
    { zoom: -1, width: W, height: H },
    { zoom: Number.NaN, width: W, height: H },
    { zoom: 1, width: 0, height: H },
    { zoom: 1, width: W, height: 0 },
  ])("returns null for a degenerate view %o", (partial) => {
    const v = { centerX: 0, centerY: 0, ...partial };
    expect(placeEdgeArrow(v, { x: 5000, y: 5000 }, insets, 0)).toBeNull();
  });
});

describe("placeEdgeArrow — placement on all four sides", () => {
  const v = view(3000, 3000);

  it("places a ship far right on the right track pointing right", () => {
    const a = placeEdgeArrow(v, { x: 4000, y: 3000 }, insets, WORLD)!;
    expect(a).toMatchObject({ x: W - INSET, y: H / 2, edge: "right" });
    expect(a.angle).toBeCloseTo(0, PRECISION);
  });

  it("places a ship far left on the left track pointing left", () => {
    const a = placeEdgeArrow(v, { x: 2000, y: 3000 }, insets, WORLD)!;
    expect(a).toMatchObject({ x: INSET, y: H / 2, edge: "left" });
    expect(Math.abs(a.angle)).toBeCloseTo(Math.PI, PRECISION);
  });

  it("places a ship far above on the top track pointing up", () => {
    const a = placeEdgeArrow(v, { x: 3000, y: 2000 }, insets, WORLD)!;
    expect(a).toMatchObject({ x: W / 2, y: INSET, edge: "top" });
    expect(a.angle).toBeCloseTo(-Math.PI / 2, PRECISION);
  });

  it("places a ship far below on the bottom track pointing down", () => {
    const a = placeEdgeArrow(v, { x: 3000, y: 4000 }, insets, WORLD)!;
    expect(a).toMatchObject({ x: W / 2, y: H - INSET, edge: "bottom" });
    expect(a.angle).toBeCloseTo(Math.PI / 2, PRECISION);
  });

  it("puts an exact-diagonal ship in the screen corner (tie goes to left/right)", () => {
    const a = placeEdgeArrow(
      v,
      { x: 3000 + W, y: 3000 + H },
      NO_INSETS,
      WORLD,
    )!;
    expect(a.x).toBeCloseTo(W, PRECISION);
    expect(a.y).toBeCloseTo(H, PRECISION);
    expect(a.edge).toBe("right");
  });

  it("keeps an odd-angle arrow on the ray from the screen centre", () => {
    const a = placeEdgeArrow(
      v,
      { x: 3000 + 1000, y: 3000 + 500 },
      insets,
      WORLD,
    )!;
    expect(a.edge).toBe("right");
    expect(a.x).toBeCloseTo(W - INSET, PRECISION);
    expect(a.y - H / 2).toBeCloseTo((a.x - W / 2) * 0.5, PRECISION);
    expect(a.angle).toBeCloseTo(Math.atan2(500, 1000), PRECISION);
  });

  it("switches to the top edge when the ray is steep", () => {
    const a = placeEdgeArrow(
      v,
      { x: 3000 - 300, y: 3000 - 1000 },
      insets,
      WORLD,
    )!;
    expect(a.edge).toBe("top");
    expect(a.y).toBeCloseTo(INSET, PRECISION);
    expect(a.x).toBeCloseTo(W / 2 - 300 * ((H / 2 - INSET) / 1000), PRECISION);
  });

  it("honours asymmetric insets", () => {
    const a = placeEdgeArrow(
      v,
      { x: 3000, y: 4000 },
      { ...insets, bottom: 100 },
      WORLD,
    )!;
    expect(a.y).toBe(H - 100);
  });

  it("clamps an inset larger than half the screen to the centre line", () => {
    const a = placeEdgeArrow(
      v,
      { x: 1000, y: 3000 },
      { ...insets, left: 5000 },
      WORLD,
    )!;
    expect(a.x).toBe(W / 2);
    expect(a.edge).toBe("left");
  });
});

describe("placeEdgeArrow — distances and the torus seam", () => {
  it("points across the seam the short way", () => {
    const a = placeEdgeArrow(
      view(5900, 3000),
      { x: 1000, y: 3000 },
      insets,
      WORLD,
    )!;
    expect(a.edge).toBe("right");
    expect(a.worldDistance).toBe(1100);
  });

  it("points up across the y seam", () => {
    const a = placeEdgeArrow(
      view(3000, 100),
      { x: 3000, y: 5200 },
      insets,
      WORLD,
    )!;
    expect(a.edge).toBe("top");
    expect(a.worldDistance).toBe(900);
  });

  it("measures the distance past the visible edge in world units at zoom 2", () => {
    const a = placeEdgeArrow(view(0, 0, 2), { x: 400, y: 0 }, insets, 0)!;
    expect(a.worldDistance).toBe(400);
    expect(a.beyondEdgeDistance).toBeCloseTo(80, PRECISION);
  });

  it("reports a near-zero beyond-edge distance just off screen", () => {
    const a = placeEdgeArrow(view(0, 0), { x: W / 2 + 1, y: 0 }, insets, 0)!;
    expect(a.beyondEdgeDistance).toBeCloseTo(1, PRECISION);
  });

  it("keeps every arrow inside the inset track for a full sweep of directions", () => {
    for (let deg = 0; deg < 360; deg += 7) {
      const rad = (deg * Math.PI) / 180;
      const a = placeEdgeArrow(
        view(0, 0),
        { x: Math.cos(rad) * 2000, y: Math.sin(rad) * 2000 },
        insets,
        0,
      )!;
      expect(a.x).toBeGreaterThanOrEqual(INSET - 1e-9);
      expect(a.x).toBeLessThanOrEqual(W - INSET + 1e-9);
      expect(a.y).toBeGreaterThanOrEqual(INSET - 1e-9);
      expect(a.y).toBeLessThanOrEqual(H - INSET + 1e-9);
      const onTrack =
        Math.abs(a.x - INSET) < 1e-9 ||
        Math.abs(a.x - (W - INSET)) < 1e-9 ||
        Math.abs(a.y - INSET) < 1e-9 ||
        Math.abs(a.y - (H - INSET)) < 1e-9;
      expect(onTrack).toBe(true);
    }
  });
});
