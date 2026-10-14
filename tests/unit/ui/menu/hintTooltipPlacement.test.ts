/**
 * Spec: a rich tooltip is placed beside the hovered element — below, above,
 * right or left, in that order — never over it and always on screen.
 */

import { describe, it, expect } from "vitest";
import {
  TOOLTIP_GAP,
  TOOLTIP_MARGIN,
  placeBesideTarget,
  type ScreenRect,
} from "../../../../src/ui/menu/hintTooltipLayout";

const SCREEN = { width: 1280, height: 720 };
const SIZE = { width: 360, height: 160 };

function overlaps(a: ScreenRect, b: ScreenRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function boxAt(point: { x: number; y: number }): ScreenRect {
  return { ...point, ...SIZE };
}

describe("placeBesideTarget", () => {
  it("goes below the target when there is room", () => {
    const target = { x: 400, y: 100, width: 100, height: 30 };
    const at = placeBesideTarget(target, SIZE, SCREEN);
    expect(at.y).toBe(target.y + target.height + TOOLTIP_GAP);
  });

  it("flips above the target near the bottom edge", () => {
    const target = { x: 400, y: 640, width: 100, height: 30 };
    const at = placeBesideTarget(target, SIZE, SCREEN);
    expect(at.y + SIZE.height + TOOLTIP_GAP).toBe(target.y);
  });

  it("goes beside a tall target that fills the height", () => {
    const target = { x: 100, y: 0, width: 200, height: 720 };
    const at = placeBesideTarget(target, SIZE, SCREEN);
    expect(overlaps(boxAt(at), target)).toBe(false);
    expect(at.x).toBeGreaterThanOrEqual(target.x + target.width);
  });

  it("falls to the left when only the left side is free", () => {
    const target = { x: 700, y: 0, width: 580, height: 720 };
    const at = placeBesideTarget(target, SIZE, SCREEN);
    expect(overlaps(boxAt(at), target)).toBe(false);
    expect(at.x + SIZE.width).toBeLessThanOrEqual(target.x);
  });

  it("never covers the target and stays on screen for targets all over", () => {
    for (let x = 0; x <= 1200; x += 120) {
      for (let y = 0; y <= 700; y += 70) {
        const target = { x, y, width: 80, height: 24 };
        const at = placeBesideTarget(target, SIZE, SCREEN);
        expect(overlaps(boxAt(at), target), `${x},${y}`).toBe(false);
        expect(at.x).toBeGreaterThanOrEqual(TOOLTIP_MARGIN);
        expect(at.y).toBeGreaterThanOrEqual(TOOLTIP_MARGIN);
        expect(at.x + SIZE.width).toBeLessThanOrEqual(SCREEN.width);
        expect(at.y + SIZE.height).toBeLessThanOrEqual(SCREEN.height);
      }
    }
  });

  it("centres on the pointer's x when the target is wide", () => {
    const target = { x: 40, y: 100, width: 1000, height: 30 };
    const at = placeBesideTarget(target, SIZE, SCREEN, { x: 800, y: 110 });
    expect(at.x).toBe(800 - SIZE.width / 2);
  });

  it("falls back beside the pointer when nothing clears a screen-sized target", () => {
    const target = { x: 0, y: 0, width: 1280, height: 720 };
    const at = placeBesideTarget(target, SIZE, SCREEN, { x: 300, y: 300 });
    expect(at.x).toBeGreaterThanOrEqual(TOOLTIP_MARGIN);
    expect(at.y).toBeGreaterThanOrEqual(TOOLTIP_MARGIN);
  });
});
