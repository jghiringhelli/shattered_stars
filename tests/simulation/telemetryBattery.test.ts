/**
 * Spec: the telemetry battery's sim-agnostic samples and per-cell summary
 * (length quantiles, first kill, DPS, hit rate, specials per ship-minute,
 * timeouts) and the cells that produce them.
 */

import { describe, it, expect } from "vitest";
import {
  cellRow,
  quantile,
  summarizeCell,
  type MatchSample,
} from "../../src/simulation/telemetryBattery";
import {
  batteryCell,
  BATTERY_CELLS,
  GATE_CELLS,
} from "../../src/simulation/batteryCells";
import { ENGINE_TEMPO } from "../../src/simulation/TempoVariant";

function sample(overrides: Partial<MatchSample> = {}): MatchSample {
  return {
    durationMs: 60_000,
    timedOut: false,
    firstKillMs: 30_000,
    damage: 120,
    shots: 40,
    hits: 20,
    specials: 6,
    ships: 2,
    side1Won: true,
    ...overrides,
  };
}

describe("summarizeCell", () => {
  it("reports length quantiles, first kill, DPS, hit rate and specials per ship-minute", () => {
    const stats = summarizeCell([
      sample(),
      sample({
        durationMs: 120_000,
        damage: 240,
        firstKillMs: 50_000,
        side1Won: false,
      }),
    ]);
    expect(stats.matches).toBe(2);
    expect(stats.medianMs).toBe(60_000);
    expect(stats.p90Ms).toBe(120_000);
    expect(stats.medianFirstKillMs).toBe(30_000);
    expect(stats.dps).toBeCloseTo(360 / 180);
    expect(stats.hitRate).toBeCloseTo(0.5);
    // 12 specials over 2 ships × 3 minutes.
    expect(stats.specialsPerShipMinute).toBeCloseTo(2);
    expect(stats.side1WinRate).toBeCloseTo(0.5);
  });

  it("counts timeouts and leaves untracked gunnery as NaN", () => {
    const stats = summarizeCell([
      sample({ timedOut: true, damage: null, shots: null, hits: null }),
    ]);
    expect(stats.timeoutRate).toBe(1);
    expect(stats.dps).toBeNaN();
    expect(stats.hitRate).toBeNaN();
  });

  it("renders a markdown row with placeholders for unknowns", () => {
    const row = cellRow(
      "Dogfight",
      "a v a",
      summarizeCell([sample({ damage: null, shots: null, hits: null })]),
    );
    expect(
      row.startsWith(
        "| Dogfight | a v a | 1 | 60s / 60s / 60s | 30s | — | — |",
      ),
    ).toBe(true);
  });

  it("takes nearest-rank quantiles", () => {
    expect(quantile([10, 20, 30, 40], 0.5)).toBe(20);
    expect(quantile([], 0.5)).toBeNaN();
  });
});

describe("battery cells", () => {
  it("have unique ids and are found by id (gates included)", () => {
    const ids = [...BATTERY_CELLS, ...GATE_CELLS].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(batteryCell("gate1")?.mode).toBe("Gate 1");
    expect(batteryCell("nope")).toBeUndefined();
  });

  it("run real matches and accept the engine tempo", () => {
    const [match] = batteryCell("dogfight:expert v novice")!.run(
      1,
      ENGINE_TEMPO,
    );
    expect(match!.durationMs).toBeGreaterThan(0);
    expect(match!.ships).toBe(2);
    expect(match!.shots).toBeGreaterThan(0);
  });
});
