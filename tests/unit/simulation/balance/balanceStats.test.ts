import { describe, it, expect } from "vitest";
import {
  addTallies,
  flipTally,
  inverseLogit,
  logit,
  percentile,
  shareInterval,
} from "../../../../src/simulation/balance/balanceStats";

describe("shareInterval", () => {
  it("counts a draw as half a win", () => {
    expect(shareInterval({ wins: 1, losses: 1, draws: 2 }).share).toBe(0.5);
  });

  it("brackets the share with a Wilson interval inside [0, 1]", () => {
    const interval = shareInterval({ wins: 8, losses: 2, draws: 0 });
    expect(interval.low).toBeLessThan(0.8);
    expect(interval.high).toBeGreaterThan(0.8);
    expect(interval.low).toBeGreaterThanOrEqual(0);
    expect(interval.high).toBeLessThanOrEqual(1);
  });

  it("narrows as games grow", () => {
    const few = shareInterval({ wins: 5, losses: 5, draws: 0 });
    const many = shareInterval({ wins: 500, losses: 500, draws: 0 });
    expect(many.high - many.low).toBeLessThan(few.high - few.low);
  });

  it("matches the textbook 95 % Wilson interval for 50 of 100", () => {
    const interval = shareInterval({ wins: 50, losses: 50, draws: 0 });
    expect(interval.low).toBeCloseTo(0.404, 3);
    expect(interval.high).toBeCloseTo(0.596, 3);
  });

  it("is uninformative with no games", () => {
    expect(shareInterval({ wins: 0, losses: 0, draws: 0 })).toEqual({
      share: 0.5,
      low: 0,
      high: 1,
      games: 0,
    });
  });
});

describe("tallies", () => {
  it("adds wins, losses and draws separately", () => {
    expect(
      addTallies(
        { wins: 1, losses: 2, draws: 3 },
        { wins: 4, losses: 5, draws: 6 },
      ),
    ).toEqual({ wins: 5, losses: 7, draws: 9 });
  });

  it("flips to the other side's view", () => {
    expect(flipTally({ wins: 3, losses: 1, draws: 2 })).toEqual({
      wins: 1,
      losses: 3,
      draws: 2,
    });
  });
});

describe("percentile", () => {
  it("returns the nearest-rank median", () => {
    expect(percentile([5, 1, 3], 0.5)).toBe(3);
  });

  it("is NaN for no values", () => {
    expect(percentile([], 0.5)).toBeNaN();
  });
});

describe("logit", () => {
  it("inverts through inverseLogit", () => {
    expect(inverseLogit(logit(0.3))).toBeCloseTo(0.3, 10);
  });

  it("stays finite at certain shares", () => {
    expect(Number.isFinite(logit(0))).toBe(true);
    expect(Number.isFinite(logit(1))).toBe(true);
  });
});
