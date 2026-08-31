import { describe, it, expect } from "vitest";
import {
  measureAuraUptime,
  sweepAuraUptime,
} from "../../../src/simulation/AuraUptimeTelemetry";

describe("measureAuraUptime", () => {
  it("returns a fraction in [0, 1]", () => {
    const uptime = measureAuraUptime({ frames: 300, seeds: 3 });
    expect(uptime).toBeGreaterThanOrEqual(0);
    expect(uptime).toBeLessThanOrEqual(1);
  });

  it("is deterministic for the same parameters", () => {
    const a = measureAuraUptime({ frames: 300, seeds: 3 });
    const b = measureAuraUptime({ frames: 300, seeds: 3 });
    expect(a).toBe(b);
  });

  it("increases uptime as the radius grows", () => {
    const tight = measureAuraUptime({ radius: 120, frames: 600, seeds: 4 });
    const wide = measureAuraUptime({ radius: 360, frames: 600, seeds: 4 });
    expect(wide).toBeGreaterThan(tight);
  });

  it("reaches near-total coverage when support outruns a slow ally", () => {
    const uptime = measureAuraUptime({
      radius: 300,
      allySpeed: 80,
      supportSpeed: 220,
      frames: 600,
      seeds: 4,
    });
    expect(uptime).toBeGreaterThan(0.9);
  });
});

describe("sweepAuraUptime", () => {
  it("returns one row per radius, sorted uptime non-decreasing", () => {
    const rows = sweepAuraUptime([120, 200, 300], { frames: 400, seeds: 3 });
    expect(rows).toHaveLength(3);
    expect(rows[1]!.uptime).toBeGreaterThanOrEqual(rows[0]!.uptime);
    expect(rows[2]!.uptime).toBeGreaterThanOrEqual(rows[1]!.uptime);
  });
});
