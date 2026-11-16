/**
 * Movement lab: the measurements behave (analog answers on the first tick,
 * turns at a constant rate, U-turns without overshoot) and the report lists
 * every table.
 */

import { describe, expect, it } from "vitest";
import { measureDuel } from "../../../src/simulation/movementLab/LabDuel";
import {
  measureConstancy,
  measureLatency,
} from "../../../src/simulation/movementLab/LabMetrics";
import { pickLabShip } from "../../../src/simulation/movementLab/LabShip";
import { measureTurn } from "../../../src/simulation/movementLab/LabTurns";
import { formatLabReport } from "../../../src/simulation/movementLab/LabReport";
import { runMovementLab } from "../../../src/simulation/movementLab/MovementLab";

const CONFIG = { definitionId: pickLabShip(), speed: 3 };

describe("movement lab measurements", () => {
  it("shows the analog key turning the ship on the first tick of a press", () => {
    expect(measureLatency("analog", CONFIG).worstMs1Deg).toBeLessThan(20);
  });

  it("shows the template engine waiting for its cycle cut", () => {
    expect(measureLatency("template", CONFIG).worstMs1Deg).toBeGreaterThan(
      measureLatency("analog", CONFIG).worstMs1Deg,
    );
  });

  it("turns at a perfectly constant rate while the analog key is held", () => {
    expect(measureConstancy("analog", CONFIG).variation).toBeLessThan(0.01);
  });

  it("makes an analog proportional pilot's U-turn without overshoot", () => {
    const turn = measureTurn("analog", "proportional", CONFIG, 180);
    expect(turn.timeMs).toBeLessThan(1100);
    expect(turn.overshootDeg).toBeLessThan(1);
  });

  it("slows the analog U-turn when the turn rate is scaled down", () => {
    const slower = measureTurn("analog", "proportional", { ...CONFIG, rateScale: 0.5 }, 180);
    const full = measureTurn("analog", "proportional", CONFIG, 180);
    expect(slower.timeMs).toBeGreaterThan(full.timeMs * 1.5);
  });

  it("is deterministic per seed", () => {
    const options = { seeds: 1, durationMs: 4000 };
    expect(measureDuel("analog", "proportional", CONFIG, options)).toEqual(
      measureDuel("analog", "proportional", CONFIG, options),
    );
  });
});

describe("movement lab report", () => {
  it("lists feel, turns, duels and the rate sweep", () => {
    const report = runMovementLab({
      speeds: [3],
      seeds: 1,
      durationMs: 3000,
      rateScales: [1, 0.5],
    });
    const markdown = formatLabReport(report);
    for (const heading of ["Input feel", "Turns", "Duel vs a novice bot", "turn-rate sweep"])
      expect(markdown).toContain(heading);
    expect(report.sweep).toHaveLength(2 * 3);
    expect(report.duels).toHaveLength(2 * 3);
  });
});
