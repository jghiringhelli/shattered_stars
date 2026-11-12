/**
 * BehaviourProfiler — the measuring tool behind `npm run profile:ai`: it only
 * reads a battle, so a profiled battle flies exactly like an unprofiled one,
 * and its counters are internally consistent.
 */

import { describe, expect, it } from "vitest";
import { profileBattle } from "../../../../src/simulation/skill/BehaviourRun";
import {
  runBattle,
  type BattleSpec,
} from "../../../../src/simulation/skill/SkillArena";

const SPEC: BattleSpec = {
  A: {
    ships: [{ definitionId: "terran_gladius", tier: "expert" }],
    squad: null,
  },
  B: {
    ships: [{ definitionId: "confed_raven", tier: "average" }],
    squad: null,
  },
  seed: 3,
  timeLimitMs: 30_000,
};

describe("BehaviourProfiler", () => {
  const profiles = profileBattle(SPEC);

  it("profiles every ship of the battle", () => {
    expect(profiles.map((p) => p.id)).toEqual(["A0", "B0"]);
  });

  it("never counts more time in arc and range than in the arc or the range", () => {
    for (const p of profiles) {
      expect(p.inArcAndRangeMs).toBeLessThanOrEqual(p.inArcMs);
      expect(p.inArcAndRangeMs).toBeLessThanOrEqual(p.inRangeMs);
      expect(p.inRangeMs).toBeLessThanOrEqual(p.aliveMs);
    }
  });

  it("counts the shots the arena's gunnery fired", () => {
    const fired = runBattle(SPEC);
    const shots = profiles.reduce((sum, p) => sum + p.shots, 0);
    expect(shots).toBe(fired.tallies.A.shots + fired.tallies.B.shots);
  });

  it("counts every cycle once and the planned ones within them", () => {
    for (const p of profiles) {
      expect(p.cycles).toBeGreaterThan(10);
      expect(p.asPlanned).toBeLessThanOrEqual(p.cycles);
      expect(p.turnCycles).toBeLessThanOrEqual(p.cycles);
    }
  });

  it("counts the decisions the recording bot saw", () => {
    for (const p of profiles) expect(p.decisions.decisions).toBeGreaterThan(50);
  });
});
