/**
 * Spec: screen-rect helpers that keep edge arrows off the bottom HUD cluster
 * by sliding them back along their own ray.
 */

import { describe, it, expect } from "vitest";
import {
  pullOutOfRect,
  inflateRect,
  type ScreenRect,
} from "../../../../src/ui/hud/screenRect";

const PRECISION = 9;

function expectVec(
  actual: { x: number; y: number },
  x: number,
  y: number,
): void {
  expect(actual.x).toBeCloseTo(x, PRECISION);
  expect(actual.y).toBeCloseTo(y, PRECISION);
}

describe("pullOutOfRect", () => {
  const center = { x: 640, y: 360 };
  const radarBox: ScreenRect = { x: 560, y: 548, width: 160, height: 172 };

  it("leaves points outside the obstacle untouched", () => {
    expectVec(pullOutOfRect(center, { x: 300, y: 694 }, radarBox), 300, 694);
  });

  it("leaves points on the obstacle boundary untouched", () => {
    expectVec(pullOutOfRect(center, { x: 600, y: 548 }, radarBox), 600, 548);
  });

  it("slides a straight-down arrow up to the obstacle top", () => {
    expectVec(pullOutOfRect(center, { x: 640, y: 694 }, radarBox), 640, 548);
  });

  it("stays on the original ray for an oblique arrow", () => {
    const to = { x: 600, y: 694 };
    const p = pullOutOfRect(center, to, radarBox);
    expect(p.y).toBeCloseTo(548, PRECISION);
    const t = (548 - center.y) / (to.y - center.y);
    expect(p.x).toBeCloseTo(center.x + (to.x - center.x) * t, PRECISION);
  });

  it("exits through the side when the ray enters from the side", () => {
    const box: ScreenRect = { x: 1100, y: 300, width: 180, height: 200 };
    const p = pullOutOfRect(center, { x: 1254, y: 380 }, box);
    expect(p.x).toBeCloseTo(1100, PRECISION);
  });

  it("collapses to the ray origin when the origin is inside the obstacle", () => {
    const box: ScreenRect = { x: 600, y: 300, width: 100, height: 400 };
    expectVec(pullOutOfRect(center, { x: 650, y: 690 }, box), 640, 360);
  });
});

describe("inflateRect", () => {
  it("grows a rect by the padding on every side", () => {
    expect(inflateRect({ x: 10, y: 20, width: 30, height: 40 }, 5)).toEqual({
      x: 5,
      y: 15,
      width: 40,
      height: 50,
    });
  });

  it("never produces a negative size", () => {
    expect(inflateRect({ x: 10, y: 20, width: 4, height: 4 }, -5)).toEqual({
      x: 12,
      y: 22,
      width: 0,
      height: 0,
    });
  });
});
