import { describe, expect, it } from "vitest";
import {
  UnwrappedTravel,
  wrapIntoArena,
} from "../../../../src/rendering/torus/torusFollowMath";

const S = 6000;

describe("wrapIntoArena", () => {
  it("wraps negatives and overflow into [0, size)", () => {
    expect(wrapIntoArena(-10, S)).toBe(5990);
    expect(wrapIntoArena(6010, S)).toBe(10);
    expect(wrapIntoArena(0, S)).toBe(0);
  });
});

describe("UnwrappedTravel", () => {
  it("starts at the first observed centre", () => {
    const travel = new UnwrappedTravel(S);
    travel.observe(1234, 4321);
    expect([travel.x, travel.y]).toEqual([1234, 4321]);
  });

  it("keeps growing when the wrapped centre jumps over the seam", () => {
    const travel = new UnwrappedTravel(S);
    travel.observe(5900, 100);
    travel.observe(20, 100);
    expect(travel.x).toBeCloseTo(6020);
    travel.observe(140, 100);
    expect(travel.x).toBeCloseTo(6140);
  });

  it("tracks backwards motion across the seam", () => {
    const travel = new UnwrappedTravel(S);
    travel.observe(40, 40);
    travel.observe(5990, 5990);
    expect(travel.x).toBeCloseTo(-10);
    expect(travel.y).toBeCloseTo(-10);
  });
});
