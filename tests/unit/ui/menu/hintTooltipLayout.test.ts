/**
 * Spec: hint tooltip placement — beside the pointer, flipped and clamped so
 * the whole tooltip stays on screen.
 */

import { describe, it, expect } from "vitest";
import {
  TOOLTIP_OFFSET,
  TOOLTIP_MARGIN,
  tooltipPosition,
} from "../../../../src/ui/menu/hintTooltipLayout";

const SCREEN = { width: 1280, height: 720 };
const SIZE = { width: 300, height: 48 };

describe("tooltipPosition", () => {
  it("sits below-right of the pointer when there is room", () => {
    expect(tooltipPosition({ x: 100, y: 100 }, SIZE, SCREEN)).toEqual({
      x: 100 + TOOLTIP_OFFSET,
      y: 100 + TOOLTIP_OFFSET,
    });
  });

  it("flips left near the right edge", () => {
    const at = tooltipPosition({ x: 1200, y: 100 }, SIZE, SCREEN);
    expect(at.x + SIZE.width).toBeLessThanOrEqual(1200);
  });

  it("flips above near the bottom edge", () => {
    const at = tooltipPosition({ x: 100, y: 700 }, SIZE, SCREEN);
    expect(at.y + SIZE.height).toBeLessThanOrEqual(700);
  });

  it("never leaves the screen, even for an oversized tooltip", () => {
    const at = tooltipPosition(
      { x: 5, y: 5 },
      { width: 1400, height: 40 },
      SCREEN,
    );
    expect(at.x).toBeGreaterThanOrEqual(TOOLTIP_MARGIN);
    expect(at.y).toBeGreaterThanOrEqual(TOOLTIP_MARGIN);
  });
});
