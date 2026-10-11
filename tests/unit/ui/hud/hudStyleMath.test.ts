/**
 * Spec: HUD presentation math — gauge fractions, closeness styling, arc
 * gauges, segmented pips, cooldown sweeps, stress/hull tinting, row layout.
 */

import { describe, it, expect } from "vitest";
import {
  gaugeFraction,
  closenessStyle,
  gaugeArc,
  segmentArcs,
  segmentFill,
  cooldownArc,
  stressBlend,
  hullStatus,
  rowCenters,
  type ClosenessOptions,
} from "../../../../src/ui/hud/hudStyleMath";

const PRECISION = 9;
const DEG = Math.PI / 180;

describe("gaugeFraction", () => {
  it("divides value by max", () => {
    expect(gaugeFraction(3, 4)).toBe(0.75);
  });

  it.each([
    [5, 4, 1],
    [-1, 4, 0],
    [2, 0, 0],
    [2, -3, 0],
    [Number.NaN, 4, 0],
    [2, Number.NaN, 0],
  ])("clamps gaugeFraction(%s, %s) to %s", (value, max, expected) => {
    expect(gaugeFraction(value, max)).toBe(expected);
  });
});

describe("closenessStyle", () => {
  const options: ClosenessOptions = {
    nearDistance: 100,
    farDistance: 1100,
    minScale: 0.5,
    maxScale: 1.5,
    minAlpha: 0.2,
    maxAlpha: 1,
  };

  it("is full size and bright at or inside the near distance", () => {
    expect(closenessStyle(0, options)).toEqual({
      visible: true,
      closeness: 1,
      scale: 1.5,
      alpha: 1,
    });
    expect(closenessStyle(100, options)).toEqual({
      visible: true,
      closeness: 1,
      scale: 1.5,
      alpha: 1,
    });
  });

  it("is smallest and faintest exactly at the far distance", () => {
    const s = closenessStyle(1100, options);
    expect(s.visible).toBe(true);
    expect(s.scale).toBeCloseTo(0.5, PRECISION);
    expect(s.alpha).toBeCloseTo(0.2, PRECISION);
  });

  it("interpolates linearly halfway", () => {
    const s = closenessStyle(600, options);
    expect(s.closeness).toBeCloseTo(0.5, PRECISION);
    expect(s.scale).toBeCloseTo(1, PRECISION);
    expect(s.alpha).toBeCloseTo(0.6, PRECISION);
  });

  it("hides markers beyond the far distance", () => {
    expect(closenessStyle(1100.01, options).visible).toBe(false);
  });

  it("is monotonic: nearer is never smaller or fainter", () => {
    let previous = closenessStyle(0, options);
    for (let d = 10; d <= 1100; d += 10) {
      const s = closenessStyle(d, options);
      expect(s.scale).toBeLessThanOrEqual(previous.scale + 1e-12);
      expect(s.alpha).toBeLessThanOrEqual(previous.alpha + 1e-12);
      previous = s;
    }
  });

  it("degrades to a step when far <= near", () => {
    const step = { ...options, farDistance: 100 };
    expect(closenessStyle(100, step).visible).toBe(true);
    expect(closenessStyle(100, step).scale).toBe(1.5);
    expect(closenessStyle(101, step).visible).toBe(false);
  });

  it("hides NaN distances", () => {
    expect(closenessStyle(Number.NaN, options).visible).toBe(false);
  });
});

describe("gaugeArc", () => {
  it("spans the whole sweep when full", () => {
    const a = gaugeArc(180, 100, 1);
    expect(a.start).toBeCloseTo(130 * DEG, PRECISION);
    expect(a.end).toBeCloseTo(230 * DEG, PRECISION);
  });

  it("grows from the start by default", () => {
    const a = gaugeArc(0, 100, 0.25);
    expect(a.start).toBeCloseTo(-50 * DEG, PRECISION);
    expect(a.end).toBeCloseTo(-25 * DEG, PRECISION);
  });

  it("grows from the clockwise end when asked", () => {
    const a = gaugeArc(0, 100, 0.25, true);
    expect(a.start).toBeCloseTo(25 * DEG, PRECISION);
    expect(a.end).toBeCloseTo(50 * DEG, PRECISION);
  });

  it("is zero-length when empty and clamps overfill", () => {
    const empty = gaugeArc(90, 60, 0);
    expect(empty.end - empty.start).toBe(0);
    const over = gaugeArc(90, 60, 7);
    expect(over.end - over.start).toBeCloseTo(60 * DEG, PRECISION);
  });

  it("treats a negative sweep as zero", () => {
    const a = gaugeArc(90, -60, 1);
    expect(a.end - a.start).toBe(0);
  });
});

describe("segmentArcs", () => {
  it("splits the sweep into equal segments with gaps", () => {
    const spans = segmentArcs(3, 180, 100, 5);
    expect(spans).toHaveLength(3);
    expect(spans[0]!.start).toBeCloseTo(130 * DEG, PRECISION);
    expect(spans[2]!.end).toBeCloseTo(230 * DEG, PRECISION);
    const segment = (100 - 2 * 5) / 3;
    for (const s of spans)
      expect(s.end - s.start).toBeCloseTo(segment * DEG, PRECISION);
    expect(spans[1]!.start - spans[0]!.end).toBeCloseTo(5 * DEG, PRECISION);
  });

  it("gives a single segment the whole sweep regardless of gap", () => {
    const [only] = segmentArcs(1, 0, 40, 10);
    expect(only!.end - only!.start).toBeCloseTo(40 * DEG, PRECISION);
  });

  it("returns nothing for zero, negative or NaN counts", () => {
    expect(segmentArcs(0, 0, 90, 2)).toEqual([]);
    expect(segmentArcs(-3, 0, 90, 2)).toEqual([]);
    expect(segmentArcs(Number.NaN, 0, 90, 2)).toEqual([]);
  });

  it("shrinks oversized gaps so segments never invert", () => {
    for (const s of segmentArcs(4, 0, 30, 50))
      expect(s.end).toBeGreaterThanOrEqual(s.start);
  });
});

describe("segmentFill", () => {
  it("fills whole, partial and empty pips", () => {
    expect([0, 1, 2, 3].map((i) => segmentFill(i, 2.5))).toEqual([
      1, 1, 0.5, 0,
    ]);
  });
});

describe("cooldownArc", () => {
  it("is null when the weapon is ready", () => {
    expect(cooldownArc(0)).toBeNull();
    expect(cooldownArc(-0.2)).toBeNull();
  });

  it("starts at 12 o'clock and sweeps clockwise by the remaining fraction", () => {
    const a = cooldownArc(0.25)!;
    expect(a.start).toBeCloseTo(-Math.PI / 2, PRECISION);
    expect(a.end).toBeCloseTo(0, PRECISION);
  });

  it("caps at a full turn", () => {
    const a = cooldownArc(3)!;
    expect(a.end - a.start).toBeCloseTo(Math.PI * 2, PRECISION);
  });
});

describe("stressBlend", () => {
  it("is 0 when calm and rises toward the stressed threshold", () => {
    expect(stressBlend(0, false, 0.7)).toBe(0);
    expect(stressBlend(0.35, false, 0.7)).toBeCloseTo(0.5, PRECISION);
    expect(stressBlend(0.9, false, 0.7)).toBe(1);
  });

  it("is fully stressed whenever the latched flag is set (hysteresis)", () => {
    expect(stressBlend(0.2, true, 0.7)).toBe(1);
  });

  it("falls back to the raw level when the threshold is not positive", () => {
    expect(stressBlend(0.4, false, 0)).toBe(0.4);
  });
});

describe("hullStatus", () => {
  it.each([
    [1, "healthy"],
    [0.61, "healthy"],
    [0.6, "damaged"],
    [0.31, "damaged"],
    [0.3, "critical"],
    [0, "critical"],
  ] as const)("classifies %s as %s", (fraction, expected) => {
    expect(hullStatus(fraction)).toBe(expected);
  });
});

describe("rowCenters", () => {
  it("centres an odd row on zero", () => {
    expect(rowCenters(3, 40, 10)).toEqual([-50, 0, 50]);
  });

  it("centres an even row on zero", () => {
    expect(rowCenters(2, 40, 10)).toEqual([-25, 25]);
  });

  it("returns nothing for an empty row", () => {
    expect(rowCenters(0, 40, 10)).toEqual([]);
  });
});
