/**
 * Unit tests for ArcadeHitRate — kinematic hit-probability telemetry.
 */

import { describe, it, expect } from "vitest";
import {
  measureHitRate,
  compareWeapons,
  sweepHitRates,
  BOLT_SPEED,
} from "../../../src/simulation/ArcadeHitRate";

describe("measureHitRate", () => {
  it("almost always hits a stationary target (residual is frame tunneling)", () => {
    const rate = measureHitRate({ range: 300, targetSpeed: 0 });
    expect(rate).toBeGreaterThan(0.9);
  });

  it("drops as target speed rises (no target leading)", () => {
    const slow = measureHitRate({ range: 300, targetSpeed: 100 });
    const fast = measureHitRate({ range: 300, targetSpeed: 600 });
    expect(fast).toBeLessThan(slow);
    expect(fast).toBeGreaterThanOrEqual(0);
  });

  it("drops with range for the same crossing speed (longer flight time)", () => {
    const near = measureHitRate({ range: 150, targetSpeed: 400 });
    const far = measureHitRate({ range: 500, targetSpeed: 400 });
    expect(far).toBeLessThan(near);
  });

  it("is deterministic across repeated calls", () => {
    const a = measureHitRate({ range: 350, targetSpeed: 300 });
    const b = measureHitRate({ range: 350, targetSpeed: 300 });
    expect(a).toBe(b);
  });
});

describe("compareWeapons", () => {
  it("gives homing missiles a higher hit rate than straight bolts vs fast movers", () => {
    const r = compareWeapons(350, 500);
    expect(r.homingMissileHitRate).toBeGreaterThan(r.boltHitRate);
  });

  it("reports the shared laser/turret bolt rate (turrets auto-aim identically)", () => {
    const r = compareWeapons(300, 200);
    const laserOrTurret = measureHitRate({
      range: 300,
      targetSpeed: 200,
      projectileSpeed: BOLT_SPEED,
    });
    expect(r.boltHitRate).toBe(laserOrTurret);
  });
});

describe("sweepHitRates", () => {
  it("produces one row per range x speed combination", () => {
    const rows = sweepHitRates([200, 400], [0, 300, 600]);
    expect(rows.length).toBe(6);
  });

  it("keeps every hit rate within [0, 1]", () => {
    const rows = sweepHitRates([200, 400], [0, 300]);
    for (const row of rows) {
      for (const rate of [
        row.boltHitRate,
        row.homingMissileHitRate,
        row.homingTorpedoHitRate,
      ]) {
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
      }
    }
  });
});
