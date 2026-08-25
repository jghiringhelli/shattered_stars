import { describe, it, expect } from "vitest";
import {
  specialistPolicy,
  generalistPolicy,
  brawlerPolicy,
} from "../../../src/simulation/SurvivalDraftPolicy";
import {
  SIM_MAX_LEVEL,
  THREAT_TO_POWER,
  fleetPower,
  simulateRun,
  summarise,
  survivalProbability,
  sweepPolicy,
} from "../../../src/simulation/SurvivalBalanceSim";
import { emptyBonuses } from "../../../src/data/survival/model";

describe("SurvivalBalanceSim — fleet power model", () => {
  it("is zero-ish for a bare fleet but positive", () => {
    expect(fleetPower(emptyBonuses(), 1)).toBeGreaterThan(0);
  });

  it("increases monotonically as any offensive bonus grows", () => {
    const base = fleetPower(emptyBonuses(), 1);
    const buffed = emptyBonuses();
    buffed.damage = 3;
    expect(fleetPower(buffed, 1)).toBeGreaterThan(base);
  });

  it("increases with more hulls", () => {
    const one = fleetPower(emptyBonuses(), 1);
    const three = fleetPower(emptyBonuses(), 3);
    expect(three).toBeGreaterThan(one);
  });

  it("rewards balanced builds over lopsided ones of equal budget", () => {
    const glassCannon = emptyBonuses();
    glassCannon.damage = 12;
    const rounded = emptyBonuses();
    rounded.damage = 6;
    rounded.maxHull = 12;
    expect(fleetPower(rounded, 1)).toBeGreaterThan(fleetPower(glassCannon, 1));
  });
});

describe("SurvivalBalanceSim — survival probability", () => {
  it("is 0.5 at power parity (power == threat * THREAT_TO_POWER)", () => {
    const threat = 10;
    expect(survivalProbability(threat * THREAT_TO_POWER, threat)).toBeCloseTo(
      0.5,
      5,
    );
  });

  it("rises toward 1 as power dominates and drops below 0.5 when outmatched", () => {
    const threat = 10;
    const parity = threat * THREAT_TO_POWER;
    expect(survivalProbability(parity * 100, threat)).toBeGreaterThan(0.99);
    expect(survivalProbability(parity * 0.25, threat)).toBeLessThan(0.5);
  });

  it("is monotonically increasing in fleet power", () => {
    const threat = 12;
    expect(survivalProbability(20, threat)).toBeGreaterThan(
      survivalProbability(10, threat),
    );
  });
});

describe("SurvivalBalanceSim — single run", () => {
  it("is deterministic for a fixed seed and policy", () => {
    const a = simulateRun(42, specialistPolicy());
    const b = simulateRun(42, specialistPolicy());
    expect(a).toEqual(b);
  });

  it("never exceeds the level cap", () => {
    const r = simulateRun(99, brawlerPolicy());
    expect(r.levelsCleared).toBeLessThanOrEqual(SIM_MAX_LEVEL);
  });

  it("records a build (some branch investment) for a run that survives a few waves", () => {
    // Average over seeds so we don't depend on one unlucky early death.
    const totals = Array.from({ length: 30 }, (_, i) =>
      simulateRun(i + 1, specialistPolicy()),
    );
    const anyInvested = totals.some((r) => r.branchSpread.some((d) => d > 0));
    expect(anyInvested).toBe(true);
  });
});

describe("SurvivalBalanceSim — balance invariants", () => {
  const RUNS = 200;

  it("no policy trivially reaches the level cap at the median", () => {
    for (const policy of [
      specialistPolicy(),
      generalistPolicy(),
      brawlerPolicy(),
    ]) {
      const { summary } = sweepPolicy(policy, RUNS, 1);
      expect(summary.median).toBeLessThan(SIM_MAX_LEVEL);
    }
  });

  it("every policy survives past the very first wave at the median", () => {
    for (const policy of [
      specialistPolicy(),
      generalistPolicy(),
      brawlerPolicy(),
    ]) {
      const { summary } = sweepPolicy(policy, RUNS, 1);
      expect(summary.median).toBeGreaterThanOrEqual(1);
    }
  });

  it("specialist unlocks capstones more readily than a random early death would allow", () => {
    const { summary } = sweepPolicy(specialistPolicy(), RUNS, 1);
    expect(summary.meanCapstones).toBeGreaterThan(0);
  });

  it("capstones and cross powers are reachable content (unlocked somewhere in a sweep)", () => {
    let capstones = 0;
    let crosses = 0;
    for (const policy of [
      specialistPolicy(),
      generalistPolicy(),
      brawlerPolicy(),
    ]) {
      const { results } = sweepPolicy(policy, RUNS, 1);
      capstones += results.reduce((a, r) => a + r.capstones, 0);
      crosses += results.reduce((a, r) => a + r.crosses, 0);
    }
    expect(capstones).toBeGreaterThan(0);
    expect(crosses).toBeGreaterThan(0);
  });

  it("escort-stacking (brawler) is no longer a runaway to the level cap", () => {
    // The redesign makes escorts weak, support-scaled bodies rather than
    // flagship copies, so the escort-heavy archetype must not snowball to the
    // cap at p90 the way it did under the old multiply-everything model.
    const brawler = sweepPolicy(brawlerPolicy(), RUNS, 1).summary;
    expect(brawler.p90).toBeLessThan(SIM_MAX_LEVEL);
  });

  it("summary percentiles are ordered p10 <= median <= p90", () => {
    const { summary } = sweepPolicy(generalistPolicy(), RUNS, 1);
    expect(summary.p10).toBeLessThanOrEqual(summary.median);
    expect(summary.median).toBeLessThanOrEqual(summary.p90);
  });
});

describe("SurvivalBalanceSim — aggregation", () => {
  it("summarise counts runs and hull distribution", () => {
    const results = [
      simulateRun(1, specialistPolicy()),
      simulateRun(2, specialistPolicy()),
      simulateRun(3, specialistPolicy()),
    ];
    const summary = summarise("specialist", results);
    expect(summary.runs).toBe(3);
    const hullTotal = Object.values(summary.hullDistribution).reduce(
      (a, b) => a + b,
      0,
    );
    expect(hullTotal).toBe(3);
  });
});
