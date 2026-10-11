/**
 * Spec: HUD geometry — torus deltas, heading-up radar projection, edge-arrow
 * placement and zoom-cancelling root transform.
 */

import { describe, it, expect } from "vitest";
import {
  shortestDelta,
  rotateToHeadingUp,
  projectToRadar,
  hudRootTransform,
  cameraViewFrom,
} from "../../../../src/ui/hud/hudMath";

const WORLD = 6000;
const PRECISION = 9;

function expectVec(
  actual: { x: number; y: number },
  x: number,
  y: number,
): void {
  expect(actual.x).toBeCloseTo(x, PRECISION);
  expect(actual.y).toBeCloseTo(y, PRECISION);
}

describe("shortestDelta", () => {
  it("returns the plain delta away from the seam", () => {
    expectVec(
      shortestDelta({ x: 100, y: 200 }, { x: 400, y: 50 }, WORLD),
      300,
      -150,
    );
  });

  it("crosses the seam forward instead of going the long way", () => {
    expectVec(shortestDelta({ x: 5950, y: 0 }, { x: 50, y: 0 }, WORLD), 100, 0);
  });

  it("crosses the seam backward", () => {
    expectVec(
      shortestDelta({ x: 50, y: 0 }, { x: 5950, y: 0 }, WORLD),
      -100,
      0,
    );
  });

  it("wraps the y axis independently", () => {
    expectVec(
      shortestDelta({ x: 10, y: 5990 }, { x: 20, y: 10 }, WORLD),
      10,
      20,
    );
  });

  it("resolves an exact half-world tie to the positive direction", () => {
    expect(shortestDelta({ x: 0, y: 0 }, { x: 3000, y: 0 }, WORLD).x).toBe(
      3000,
    );
    expect(shortestDelta({ x: 3000, y: 0 }, { x: 0, y: 0 }, WORLD).x).toBe(
      3000,
    );
  });

  it("handles unnormalised coordinates outside [0, size)", () => {
    expectVec(
      shortestDelta({ x: 6100, y: -20 }, { x: 50, y: 5990 }, WORLD),
      -50,
      10,
    );
  });

  it("never returns a component longer than half the world", () => {
    for (let a = -7000; a <= 13000; a += 437) {
      for (let b = 0; b < WORLD; b += 611) {
        const d = shortestDelta({ x: a, y: b }, { x: b, y: a }, WORLD);
        expect(Math.abs(d.x)).toBeLessThanOrEqual(WORLD / 2);
        expect(Math.abs(d.y)).toBeLessThanOrEqual(WORLD / 2);
      }
    }
  });

  it.each([0, -6000, Number.NaN, Number.POSITIVE_INFINITY])(
    "treats world size %s as an unwrapped plane",
    (size) => {
      expectVec(
        shortestDelta({ x: 5950, y: 0 }, { x: 50, y: 10 }, size),
        -5900,
        10,
      );
    },
  );
});

describe("rotateToHeadingUp", () => {
  const forwardOf = (deg: number): { x: number; y: number } => ({
    x: Math.sin((deg * Math.PI) / 180),
    y: -Math.cos((deg * Math.PI) / 180),
  });

  it.each([0, 90, 180, 270, 30, 123.4, 359.9, -45, 450])(
    "maps the forward vector of heading %s° to straight up",
    (deg) => {
      expectVec(rotateToHeadingUp(forwardOf(deg), deg), 0, -1);
    },
  );

  it("is the identity at heading 0", () => {
    expectVec(rotateToHeadingUp({ x: 3, y: -7 }, 0), 3, -7);
  });

  it("maps the right wing to +x when facing east (90°)", () => {
    expectVec(rotateToHeadingUp({ x: 0, y: 1 }, 90), 1, 0);
  });

  it("flips north to down when facing south (180°)", () => {
    expectVec(rotateToHeadingUp({ x: 0, y: -1 }, 180), 0, 1);
  });

  it("maps north to the right when facing west (270°)", () => {
    expectVec(rotateToHeadingUp({ x: 0, y: -1 }, 270), 1, 0);
  });

  it("preserves vector length at odd angles", () => {
    const r = rotateToHeadingUp({ x: 3, y: 4 }, 77.7);
    expect(Math.hypot(r.x, r.y)).toBeCloseTo(5, PRECISION);
  });

  it("treats -90° and 270° identically", () => {
    const a = rotateToHeadingUp({ x: 2, y: 5 }, -90);
    expectVec(rotateToHeadingUp({ x: 2, y: 5 }, 270), a.x, a.y);
  });
});

describe("projectToRadar", () => {
  const options = { rangePx: 1000, radiusPx: 80, worldSize: WORLD };
  const at = (
    x: number,
    y: number,
    angle = 0,
  ): { x: number; y: number; angle: number } => ({ x, y, angle });

  it("puts a contact straight ahead above the centre", () => {
    const p = projectToRadar(at(1000, 1000), { x: 1000, y: 500 }, options);
    expectVec(p, 0, -40);
    expect(p.inRange).toBe(true);
    expect(p.distance).toBe(500);
  });

  it("puts a contact east of an east-facing ship straight up", () => {
    expectVec(
      projectToRadar(at(1000, 1000, 90), { x: 1500, y: 1000 }, options),
      0,
      -40,
    );
  });

  it("puts a contact south of a south-facing ship up and one north down", () => {
    expectVec(
      projectToRadar(at(1000, 1000, 180), { x: 1000, y: 1500 }, options),
      0,
      -40,
    );
    expectVec(
      projectToRadar(at(1000, 1000, 180), { x: 1000, y: 500 }, options),
      0,
      40,
    );
  });

  it("puts a contact north of a west-facing ship on the right", () => {
    expectVec(
      projectToRadar(at(1000, 1000, 270), { x: 1000, y: 500 }, options),
      40,
      0,
    );
  });

  it("rotates an off-axis contact at an odd heading", () => {
    const deg = 45;
    const p = projectToRadar(
      at(1000, 1000, deg),
      { x: 1000 + 500, y: 1000 },
      options,
    );
    const angle = (deg * Math.PI) / 180;
    expectVec(p, 40 * Math.cos(angle), -40 * Math.sin(angle));
  });

  it("keeps a contact exactly at range on the rim and in range", () => {
    const p = projectToRadar(at(0, 3000), { x: 1000, y: 3000 }, options);
    expectVec(p, 80, 0);
    expect(p.inRange).toBe(true);
  });

  it("clamps a contact beyond range to the rim and flags it", () => {
    const p = projectToRadar(
      at(1000, 1000),
      { x: 1000 + 1500, y: 1000 + 2000 },
      options,
    );
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(80, PRECISION);
    expectVec(p, 80 * 0.6, 80 * 0.8);
    expect(p.inRange).toBe(false);
    expect(p.distance).toBeCloseTo(2500, PRECISION);
  });

  it("uses the short way across the seam", () => {
    const p = projectToRadar(at(5950, 3000, 90), { x: 50, y: 3000 }, options);
    expectVec(p, 0, -8);
    expect(p.distance).toBe(100);
  });

  it("puts a co-located contact at the centre", () => {
    const p = projectToRadar(at(10, 10, 33), { x: 10, y: 10 }, options);
    expectVec(p, 0, 0);
    expect(p.inRange).toBe(true);
  });

  it.each([0, -50, Number.NaN])(
    "pins every contact to the rim when range is %s",
    (rangePx) => {
      const p = projectToRadar(
        at(0, 0),
        { x: 0, y: -10 },
        { ...options, rangePx },
      );
      expectVec(p, 0, -80);
      expect(p.inRange).toBe(false);
    },
  );

  it("collapses to the centre when the radius is zero or negative", () => {
    expectVec(
      projectToRadar(at(0, 0), { x: 300, y: 0 }, { ...options, radiusPx: -5 }),
      0,
      0,
    );
  });
});

describe("hudRootTransform", () => {
  it("is the identity at zoom 1", () => {
    expect(hudRootTransform(1, 1280, 720)).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it("shrinks and offsets toward the centre when zoomed in", () => {
    expect(hudRootTransform(2, 1280, 720)).toEqual({
      x: 320,
      y: 180,
      scale: 0.5,
    });
  });

  it("grows and offsets outward when zoomed out", () => {
    expect(hudRootTransform(0.5, 1280, 720)).toEqual({
      x: -640,
      y: -360,
      scale: 2,
    });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "falls back to identity for zoom %s",
    (zoom) => {
      expect(hudRootTransform(zoom, 1280, 720)).toEqual({
        x: 0,
        y: 0,
        scale: 1,
      });
    },
  );

  it("cancels Phaser's zoom-about-centre for every child point", () => {
    for (const zoom of [0.4, 0.8, 1.37, 2]) {
      const root = hudRootTransform(zoom, 1280, 720);
      for (const [px, py] of [
        [0, 0],
        [1280, 720],
        [17, 650],
        [640, 360],
      ] as const) {
        const renderedX = 640 + (root.x + px * root.scale - 640) * zoom;
        const renderedY = 360 + (root.y + py * root.scale - 360) * zoom;
        expect(renderedX).toBeCloseTo(px, PRECISION);
        expect(renderedY).toBeCloseTo(py, PRECISION);
      }
    }
  });
});

describe("cameraViewFrom", () => {
  it("centres on scroll plus half the viewport regardless of zoom", () => {
    const view = cameraViewFrom({
      scrollX: 100,
      scrollY: -50,
      zoom: 1.7,
      width: 1280,
      height: 720,
    });
    expect(view).toEqual({
      centerX: 740,
      centerY: 310,
      zoom: 1.7,
      width: 1280,
      height: 720,
    });
  });
});
