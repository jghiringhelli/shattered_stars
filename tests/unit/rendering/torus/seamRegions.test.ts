import { describe, expect, it } from "vitest";
import {
  computeSeamRegions,
  createRegionCamera,
  createSeamRegions,
  placeRegionCamera,
  regionNeedsObject,
  type SeamView,
} from "../../../../src/rendering/torus/seamRegions";

const S = 6000;
const SCREEN = { width: 1280, height: 720 };

function viewAt(x: number, y: number, zoom = 1): SeamView {
  return {
    centerX: x,
    centerY: y,
    halfWidth: SCREEN.width / (2 * zoom),
    halfHeight: SCREEN.height / (2 * zoom),
  };
}

function regionsFor(view: SeamView) {
  const pool = createSeamRegions();
  const count = computeSeamRegions(view, S, pool);
  return pool.slice(0, count);
}

describe("computeSeamRegions", () => {
  it("needs no copies when the view is well inside the arena", () => {
    expect(regionsFor(viewAt(3000, 3000))).toHaveLength(0);
  });

  it("needs one copy on the right when the view crosses the left edge", () => {
    const regions = regionsFor(viewAt(200, 3000));
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ cellX: -1, cellY: 0, offsetX: -S });
    expect(regions[0]!.left).toBeCloseTo(200 - 640);
    expect(regions[0]!.right).toBe(0);
  });

  it("needs one copy when the view crosses the right edge", () => {
    const regions = regionsFor(viewAt(5900, 3000));
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ cellX: 1, offsetX: S });
    expect(regions[0]!.left).toBe(S);
  });

  it("needs a copy across the top and bottom edges", () => {
    expect(regionsFor(viewAt(3000, 100))[0]).toMatchObject({ cellY: -1 });
    expect(regionsFor(viewAt(3000, 5900))[0]).toMatchObject({ cellY: 1 });
  });

  it("needs three copies at a corner (side, top/bottom and diagonal)", () => {
    const regions = regionsFor(viewAt(100, 100));
    expect(regions).toHaveLength(3);
    const cells = regions.map((r) => `${r.cellX},${r.cellY}`).sort();
    expect(cells).toEqual(["-1,-1", "-1,0", "0,-1"]);
  });

  it("does not report a copy when the view only touches the seam", () => {
    expect(regionsFor(viewAt(640, 3000))).toHaveLength(0);
  });

  it("handles a zoomed-out view wider than half the arena", () => {
    const regions = regionsFor(viewAt(3000, 3000, 0.2));
    // 6400 px wide: both side images, and top/bottom (3600 px tall: none)
    expect(regions.map((r) => r.cellX).sort()).toEqual([-1, 1]);
  });

  it("reuses the pool without allocating new regions", () => {
    const pool = createSeamRegions();
    const first = pool[0];
    computeSeamRegions(viewAt(100, 100), S, pool);
    expect(pool[0]).toBe(first);
  });
});

describe("placeRegionCamera", () => {
  /** Phaser's world → screen mapping for a camera. */
  function screenX(
    worldX: number,
    camera: { x: number; width: number; scrollX: number },
    zoom: number,
  ): number {
    return (
      camera.x + camera.width / 2 + zoom * (worldX - camera.scrollX - camera.width / 2)
    );
  }

  it("draws a source object where the main camera would show its far-side image", () => {
    const zoom = 0.8;
    const view = viewAt(150, 3000, zoom);
    const [region] = regionsFor(view);
    const camera = createRegionCamera();
    expect(placeRegionCamera(region!, view, zoom, SCREEN, camera)).toBe(true);
    // A ship at x = 5950 (real arena) appears at display x = −50.
    const expected = SCREEN.width / 2 + zoom * (-50 - view.centerX);
    expect(screenX(5950, camera, zoom)).toBeCloseTo(expected, 5);
  });

  it("keeps the viewport inside the screen and flush with the seam", () => {
    const zoom = 1;
    const view = viewAt(5800, 3000, zoom);
    const [region] = regionsFor(view);
    const camera = createRegionCamera();
    placeRegionCamera(region!, view, zoom, SCREEN, camera);
    expect(camera.x + camera.width).toBe(SCREEN.width);
    expect(camera.x).toBe(Math.floor(640 + (S - 5800)));
    expect(camera.y).toBe(0);
    expect(camera.height).toBe(SCREEN.height);
  });

  it("maps vertically too", () => {
    const zoom = 1;
    const view = viewAt(3000, 200, zoom);
    const [region] = regionsFor(view);
    const camera = createRegionCamera();
    placeRegionCamera(region!, view, zoom, SCREEN, camera);
    const screenY =
      camera.y + camera.height / 2 + zoom * (5990 - camera.scrollY - camera.height / 2);
    expect(screenY).toBeCloseTo(360 + zoom * (-10 - 200), 5);
  });

  it("reports false for a region that is off screen", () => {
    const view = viewAt(5900, 3000);
    const camera = createRegionCamera();
    const region = {
      cellX: 1,
      cellY: 0,
      offsetX: S,
      offsetY: 0,
      left: 9000,
      right: 9100,
      top: 2640,
      bottom: 3360,
    };
    expect(placeRegionCamera(region, view, 1, SCREEN, camera)).toBe(false);
  });
});

describe("regionNeedsObject", () => {
  const view = viewAt(150, 3000);
  const [region] = regionsFor(view);

  it("includes an object just across the seam", () => {
    expect(regionNeedsObject(5950, 3000, region!, 100)).toBe(true);
  });

  it("excludes an object in the middle of the arena", () => {
    expect(regionNeedsObject(3000, 3000, region!, 100)).toBe(false);
  });

  it("excludes an object far above the region", () => {
    expect(regionNeedsObject(5950, 800, region!, 100)).toBe(false);
  });

  it("always includes absolute-coordinate graphics at the origin", () => {
    expect(regionNeedsObject(0, 0, region!, 0)).toBe(true);
  });
});
