import { describe, it, expect } from "vitest";
import {
  SurvivalRunController,
  DRAFT_SIZE,
} from "../../../../src/systems/survival/SurvivalRunController";

describe("SurvivalRunController progression", () => {
  it("starts at level 0 on the workhorse hull", () => {
    const c = new SurvivalRunController(1);
    expect(c.level).toBe(0);
    expect(c.state.hull).toBe("workhorse");
  });

  it("beginWave advances the level and reports the wave number", () => {
    const c = new SurvivalRunController(1);
    expect(c.beginWave()).toBe(1);
    expect(c.beginWave()).toBe(2);
    expect(c.level).toBe(2);
  });

  it("marks every fifth level as a milestone", () => {
    const c = new SurvivalRunController(1);
    for (let i = 0; i < 4; i++) c.beginWave();
    expect(c.isMilestone).toBe(false);
    c.beginWave();
    expect(c.isMilestone).toBe(true);
  });
});

describe("SurvivalRunController drafting", () => {
  it("draws DRAFT_SIZE distinct powers by default", () => {
    const c = new SurvivalRunController(42);
    const drawn = c.draft();
    expect(drawn).toHaveLength(DRAFT_SIZE);
    expect(new Set(drawn.map((p) => p.id)).size).toBe(DRAFT_SIZE);
  });

  it("is deterministic for the same seed", () => {
    const a = new SurvivalRunController(7).draft().map((p) => p.id);
    const b = new SurvivalRunController(7).draft().map((p) => p.id);
    expect(a).toEqual(b);
  });

  it("choosePower folds the stat delta into bonuses", () => {
    const c = new SurvivalRunController(7, "ace");
    const power = c.draft().find((p) => p.stat === "damage");
    if (power) {
      c.choosePower(power);
      expect(c.bonuses.damage).toBeGreaterThan(0);
    }
  });
});

describe("SurvivalRunController hangar", () => {
  it("offers graduation lanes plus escort and evolve", () => {
    const c = new SurvivalRunController(1);
    const kinds = c.hangar().map((o) => o.kind);
    expect(kinds).toContain("graduate");
    expect(kinds).toContain("escort");
    expect(kinds).toContain("evolve");
  });

  it("graduating changes the hull", () => {
    const c = new SurvivalRunController(1);
    const graduate = c.hangar().find((o) => o.kind === "graduate");
    if (graduate) {
      c.chooseHangar(graduate);
      expect(c.state.hull).toBe(graduate.hull);
    }
  });

  it("choosing escort raises the pending escort count", () => {
    const c = new SurvivalRunController(1);
    const escort = c.hangar().find((o) => o.kind === "escort")!;
    c.chooseHangar(escort);
    expect(c.pendingEscorts()).toBe(1);
    c.markEscortSpawned();
    expect(c.pendingEscorts()).toBe(0);
  });
});

describe("SurvivalRunController wave sizing", () => {
  it("produces at least one enemy and adds an elite on milestones", () => {
    const c = new SurvivalRunController(1);
    for (let i = 0; i < 5; i++) c.beginWave(); // level 5 = milestone
    const wave = c.waveSize(1);
    expect(wave.enemyCount).toBeGreaterThanOrEqual(1);
    expect(wave.eliteCount).toBeGreaterThanOrEqual(1);
  });

  it("scales the wave up as the fleet grows", () => {
    const c = new SurvivalRunController(1);
    c.beginWave();
    const small = c.waveSize(1).enemyCount;
    const large = c.waveSize(6).enemyCount;
    expect(large).toBeGreaterThanOrEqual(small);
  });
});
