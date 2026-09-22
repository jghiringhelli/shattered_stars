/**
 * Gate: panel chrome is drawn at the size it was asked for.
 *
 * The previous panels stretched a fixed-size PNG to arbitrary dimensions with
 * setDisplaySize, which is why a 300x50 menu button rendered as a smeared
 * block. Chrome drawn with Graphics has no source resolution to distort, but
 * only if it actually honours the requested bounds.
 */

import { describe, it, expect } from "vitest";
import {
  drawPanelChrome,
  CORNER_CUT,
  type ChromeTarget,
} from "../../../src/ui/PanelChrome";

interface Point {
  readonly x: number;
  readonly y: number;
}

/** Records every path point so a test can measure the drawn bounds. */
class RecordingGraphics implements ChromeTarget {
  readonly points: Point[] = [];
  readonly fills: number[] = [];
  readonly strokes: number[] = [];
  fillPaths = 0;
  strokePaths = 0;
  cleared = 0;

  clear(): this {
    this.cleared += 1;
    return this;
  }
  fillStyle(color: number): this {
    this.fills.push(color);
    return this;
  }
  lineStyle(_width: number, color: number): this {
    this.strokes.push(color);
    return this;
  }
  beginPath(): this {
    return this;
  }
  closePath(): this {
    return this;
  }
  moveTo(x: number, y: number): this {
    this.points.push({ x, y });
    return this;
  }
  lineTo(x: number, y: number): this {
    this.points.push({ x, y });
    return this;
  }
  fillPath(): this {
    this.fillPaths += 1;
    return this;
  }
  strokePath(): this {
    this.strokePaths += 1;
    return this;
  }

  get bounds() {
    const xs = this.points.map((p) => p.x);
    const ys = this.points.map((p) => p.y);
    return {
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys),
    };
  }
}

function draw(width: number, height: number, selected = false) {
  const g = new RecordingGraphics();
  drawPanelChrome(g, { width, height, selected });
  return g;
}

describe("drawPanelChrome", () => {
  it("fills exactly the box it was given, centred on the origin", () => {
    const g = draw(300, 50);
    const { left, right, top, bottom } = g.bounds;
    expect(right - left).toBeCloseTo(300, 6);
    expect(bottom - top).toBeCloseTo(50, 6);
    expect(left).toBeCloseTo(-150, 6);
    expect(top).toBeCloseTo(-25, 6);
  });

  it("keeps the same corner cut whatever the panel size", () => {
    // A stretched bitmap scales its corners with the box, so a wide button
    // gets stretched bevels. Drawn chrome must not.
    const small = draw(120, 60);
    const wide = draw(900, 60);
    const smallInset = small.points.filter(
      (p) => Math.abs(p.x - (-60 + CORNER_CUT)) < 0.001,
    );
    const wideInset = wide.points.filter(
      (p) => Math.abs(p.x - (-450 + CORNER_CUT)) < 0.001,
    );
    expect(smallInset.length).toBeGreaterThan(0);
    expect(wideInset.length).toBe(smallInset.length);
  });

  it("never lets the corner cut collapse the panel on a short box", () => {
    // A 20px-tall panel cannot carry a 14px bevel at both ends without the
    // path crossing itself.
    const g = draw(200, 20);
    const { top, bottom } = g.bounds;
    expect(bottom - top).toBeCloseTo(20, 6);
    for (const p of g.points) {
      expect(p.y).toBeGreaterThanOrEqual(top - 0.001);
      expect(p.y).toBeLessThanOrEqual(bottom + 0.001);
    }
  });

  it("both fills and strokes, so the panel reads as a framed surface", () => {
    const g = draw(300, 50);
    expect(g.fillPaths).toBeGreaterThan(0);
    expect(g.strokePaths).toBeGreaterThan(0);
  });

  it("clears before drawing so repeated redraws do not stack", () => {
    const g = draw(300, 50);
    expect(g.cleared).toBe(1);
  });

  it("distinguishes the selected state by colour, not by size", () => {
    const idle = draw(300, 50, false);
    const selected = draw(300, 50, true);
    expect(selected.strokes).not.toEqual(idle.strokes);
    expect(selected.bounds).toEqual(idle.bounds);
  });
});
