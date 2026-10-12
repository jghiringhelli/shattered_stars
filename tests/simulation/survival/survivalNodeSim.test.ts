/**
 * Spec: the node-based Survival sims — a battle node fought headless the
 * way SurvivalScene fights it, and a whole run walked through the game's
 * run operations — are deterministic, terminate, and report what the
 * balance sweep needs.
 */

import { describe, it, expect } from "vitest";
import {
  createRun,
  FREE_STARTING_ESCORTS,
} from "../../../src/systems/survival/RunState";
import { enterNode } from "../../../src/systems/survival/RunNavigation";
import { nextOptions } from "../../../src/systems/survival/SectorMapGenerator";
import { flagshipLoadout } from "../../../src/arcade/systems/SurvivalLoadouts";
import { simulateNodeBattle } from "../../../src/simulation/survival/SurvivalNodeSim";
import { simulateSurvivalRun } from "../../../src/simulation/survival/SurvivalRunSim";
import {
  clearStats,
  percentile,
  summarizeSweep,
} from "../../../src/simulation/survival/runSweep";
import type { RunState } from "../../../src/systems/survival/RunTypes";

function firstCombat(seed: number): RunState {
  const run = createRun({
    seed,
    faction: "terran_hegemony",
    flagshipId: "terran_viper",
    loadoutId: flagshipLoadout("terran_viper", null),
    ascension: 0,
    unlocked: [],
    now: 0,
  });
  return enterNode(run, nextOptions(run.map, null)[0]!.id);
}

describe("simulateNodeBattle", () => {
  const run = firstCombat(7);
  const battle = simulateNodeBattle(run);

  it("is deterministic for a run and node", () => {
    const again = simulateNodeBattle(run);
    expect(again.durationMs).toBe(battle.durationMs);
    expect(again.won).toBe(battle.won);
  });

  it("fights the run's fleet (flagship + free wingman) against the node's wave and reports a decision", () => {
    expect(battle.playerShips).toBe(1 + FREE_STARTING_ESCORTS);
    expect(battle.enemyShips).toBeGreaterThanOrEqual(1);
    expect(battle.timedOut).toBe(false);
    expect(battle.durationMs).toBeGreaterThan(0);
  });

  it("hands back survivors with hull fractions for a won battle", () => {
    const won = [7, 8, 9, 10, 11]
      .map((seed) => simulateNodeBattle(firstCombat(seed)))
      .find((b) => b.won);
    expect(won).toBeDefined();
    for (const s of won!.outcome.survivors) {
      expect(s.hull).toBeGreaterThan(0);
      expect(s.hull).toBeLessThanOrEqual(1);
    }
    expect(won!.kills).toBeGreaterThanOrEqual(1);
  });

  it("spares a belt-aware pilot every belt loss", () => {
    for (const seed of [1, 2, 3, 4]) {
      expect(
        simulateNodeBattle(firstCombat(seed), { playerBeltDamage: false })
          .beltLosses,
      ).toBe(0);
    }
  });
});

describe("simulateSurvivalRun", () => {
  const result = simulateSurvivalRun({ seed: 3 });

  it("is deterministic for a seed", () => {
    const again = simulateSurvivalRun({ seed: 3 });
    expect(again.battles.map((b) => b.battle.durationMs)).toEqual(
      result.battles.map((b) => b.battle.durationMs),
    );
  });

  it("ends in a win or a lost battle, after at least one battle", () => {
    expect(result.battles.length).toBeGreaterThan(0);
    const last = result.battles[result.battles.length - 1]!;
    expect(result.won || !last.battle.won).toBe(true);
  });

  it("records where each battle was fought and the flagship's hull going in", () => {
    for (const b of result.battles) {
      expect(b.sector).toBeGreaterThanOrEqual(1);
      expect(b.startHull).toBeGreaterThan(0);
      expect(["combat", "elite", "boss"]).toContain(b.kind);
    }
  });
});

describe("runSweep", () => {
  it("summarises clear rates and node length per sector", () => {
    const runs = [
      simulateSurvivalRun({ seed: 1 }),
      simulateSurvivalRun({ seed: 2 }),
    ];
    const summary = summarizeSweep(runs);
    const battles = runs.flatMap((r) => r.battles);
    expect(summary.runs).toBe(2);
    expect(summary.bySector[0]!.fought).toBe(
      battles.filter((b) => b.sector === 1).length,
    );
    expect(summary.all.cleared).toBe(
      battles.filter((b) => b.battle.won).length,
    );
    expect(summary.reached[0]).toBe(2);
  });

  it("reports NaN rates for an empty group", () => {
    expect(clearStats([]).rate).toBeNaN();
  });

  it("takes nearest-rank percentiles", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
    expect(percentile([], 0.5)).toBeNaN();
  });
});
