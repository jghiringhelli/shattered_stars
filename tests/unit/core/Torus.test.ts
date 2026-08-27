import { describe, it, expect } from "vitest";
import {
  torusAxisDelta,
  torusDelta,
  torusDistance,
} from "../../../src/core/Torus";

describe("Torus math", () => {
  const SIZE = 6000;

  describe("torusAxisDelta", () => {
    it("returns direct delta when points are close and away from seam", () => {
      expect(torusAxisDelta(1000, 1500, SIZE)).toBe(500);
      expect(torusAxisDelta(1500, 1000, SIZE)).toBe(-500);
    });

    it("returns shortest path across the seam (b > a, far)", () => {
      // From 500 → 5500 direct is +5000, but wrapping is -1000
      expect(torusAxisDelta(500, 5500, SIZE)).toBe(-1000);
    });

    it("returns shortest path across the seam (b < a, far)", () => {
      // From 5500 → 500 direct is -5000, wrapping is +1000
      expect(torusAxisDelta(5500, 500, SIZE)).toBe(1000);
    });

    it("returns zero for identical points", () => {
      expect(torusAxisDelta(3000, 3000, SIZE)).toBe(0);
    });

    it("handles exactly half-size delta consistently", () => {
      // 0 → 3000 = exactly half; either direction is valid, we pick +half
      const d = torusAxisDelta(0, 3000, SIZE);
      expect(Math.abs(d)).toBe(3000);
    });
  });

  describe("torusDelta", () => {
    it("wraps both axes independently", () => {
      const d = torusDelta(500, 500, 5500, 5500, SIZE);
      expect(d.dx).toBe(-1000);
      expect(d.dy).toBe(-1000);
    });
  });

  describe("torusDistance", () => {
    it("computes short-path Euclidean across the seam", () => {
      // From (500, 500) to (5500, 5500): direct = sqrt(5000² + 5000²) ≈ 7071,
      // wrapped = sqrt(1000² + 1000²) ≈ 1414
      const d = torusDistance(500, 500, 5500, 5500, SIZE);
      expect(d).toBeCloseTo(Math.sqrt(2) * 1000, 5);
    });

    it("agrees with raw distance for nearby points", () => {
      const d = torusDistance(3000, 3000, 3300, 3400, SIZE);
      expect(d).toBeCloseTo(500, 5);
    });

    it("is symmetric", () => {
      const a = torusDistance(200, 300, 5800, 5700, SIZE);
      const b = torusDistance(5800, 5700, 200, 300, SIZE);
      expect(a).toBeCloseTo(b, 10);
    });
  });
});
