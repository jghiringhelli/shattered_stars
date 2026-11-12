import { describe, expect, it } from "vitest";
import {
  easeOutQuad,
  lerpAngleDegrees,
  lerpTorusAxis,
  shortestAngleDelta,
  smoothingGain,
} from "../../../../src/rendering/smoothing/poseMath";
import {
  flownSpeed,
  speedZoomTarget,
} from "../../../../src/rendering/smoothing/speedZoom";

const SIZE = 6000;

describe("shortestAngleDelta", () => {
  it("turns the short way across 0/360", () => {
    expect(shortestAngleDelta(350, 10)).toBe(20);
    expect(shortestAngleDelta(10, 350)).toBe(-20);
  });

  it("returns 0 for equal angles a full turn apart", () => {
    expect(shortestAngleDelta(30, 390)).toBeCloseTo(0);
  });
});

describe("lerpAngleDegrees", () => {
  it("interpolates halfway round the short side", () => {
    expect(lerpAngleDegrees(350, 10, 0.5)).toBe(360);
  });

  it("returns the endpoints at 0 and 1", () => {
    expect(lerpAngleDegrees(90, 135, 0)).toBe(90);
    expect(lerpAngleDegrees(90, 135, 1)).toBe(135);
  });
});

describe("lerpTorusAxis", () => {
  it("crosses the seam the short way and stays in the arena", () => {
    expect(lerpTorusAxis(5990, 10, 0.5, SIZE)).toBe(0);
    expect(lerpTorusAxis(5990, 10, 0.25, SIZE)).toBe(5995);
  });

  it("interpolates plainly away from the seam", () => {
    expect(lerpTorusAxis(100, 200, 0.5, SIZE)).toBe(150);
  });
});

describe("easeOutQuad", () => {
  it("runs 0 to 1, fast first", () => {
    expect(easeOutQuad(0)).toBe(0);
    expect(easeOutQuad(1)).toBe(1);
    expect(easeOutQuad(0.5)).toBeGreaterThan(0.5);
  });

  it("clamps out-of-range progress", () => {
    expect(easeOutQuad(-1)).toBe(0);
    expect(easeOutQuad(2)).toBe(1);
  });
});

describe("smoothingGain", () => {
  it("composes: two half frames close as much as one whole frame", () => {
    const whole = smoothingGain(20, 100);
    const half = smoothingGain(10, 100);
    expect(1 - (1 - half) * (1 - half)).toBeCloseTo(whole, 12);
  });

  it("is 0 without time and 1 without a time constant", () => {
    expect(smoothingGain(0, 100)).toBe(0);
    expect(smoothingGain(16, 0)).toBe(1);
  });
});

describe("speedZoomTarget", () => {
  const range = { slowest: 1, fastest: 0.75 };

  it("zooms out as the flown speed rises", () => {
    expect(speedZoomTarget({ speed: 1 }, range)).toBe(1);
    expect(speedZoomTarget({ speed: 5 }, range)).toBe(0.75);
    expect(speedZoomTarget({ speed: 3 }, range)).toBeCloseTo(0.875);
  });

  it("uses the speed the cycle is flown at, not the set throttle", () => {
    expect(flownSpeed({ speed: 5, cycleSpeed: 3 })).toBe(3);
    expect(speedZoomTarget({ speed: 5, cycleSpeed: 1 }, range)).toBe(1);
  });

  it("clamps speeds outside the notches", () => {
    expect(speedZoomTarget({ speed: 9 }, range)).toBe(0.75);
    expect(speedZoomTarget({ speed: 0 }, range)).toBe(1);
  });
});
