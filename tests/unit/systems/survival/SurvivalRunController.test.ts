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
  it("offers graduation lanes plus evolve (no escort)", () => {
    const c = new SurvivalRunController(1);
    const kinds = c.hangar().map((o) => o.kind);
    expect(kinds).toContain("graduate");
    expect(kinds).toContain("evolve");
    expect(kinds).not.toContain("escort");
  });

  it("graduating changes the hull", () => {
    const c = new SurvivalRunController(1);
    const graduate = c.hangar().find((o) => o.kind === "graduate");
    if (graduate) {
      c.chooseHangar(graduate);
      expect(c.state.hull).toBe(graduate.hull);
    }
  });

  it("recruiting on the escort track raises the pending escort count", () => {
    const c = new SurvivalRunController(1);
    const recruit = c.draftEscort().find((o) => o.kind === "recruit")!;
    c.chooseEscort(recruit);
    expect(c.pendingEscorts()).toBe(1);
    c.markEscortSpawned();
    expect(c.pendingEscorts()).toBe(0);
  });

  it("banking on the escort track adds a reroll charge", () => {
    const c = new SurvivalRunController(1);
    const bank = c.draftEscort().find((o) => o.kind === "bank")!;
    c.chooseEscort(bank);
    expect(c.state.rerolls).toBe(1);
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

describe("SurvivalRunController rerolls (were never spent)", () => {
  it("spends a reroll charge on a fresh draft", () => {
    const c = new SurvivalRunController(1);
    const bank = c.draftEscort().find((o) => o.kind === "bank")!;
    c.chooseEscort(bank);
    expect(c.rerollDraft()).toHaveLength(DRAFT_SIZE);
    expect(c.state.rerolls).toBe(0);
  });

  it("refuses to reroll without charges", () => {
    expect(new SurvivalRunController(1).rerollDraft()).toBeNull();
  });
});

describe("SurvivalRunController roguelite battles", () => {
  it("restores a saved progression without mutating it and without pending escorts", () => {
    const source = new SurvivalRunController(1);
    source.beginWave();
    const recruit = source.draftEscort().find((o) => o.kind === "recruit")!;
    source.chooseEscort(recruit);
    const saved = structuredClone(source.state);
    const restored = SurvivalRunController.fromState(9, saved);
    expect(restored.level).toBe(1);
    expect(restored.state.escorts).toBe(1);
    expect(restored.pendingEscorts()).toBe(0);
    restored.beginWave();
    expect(saved.level).toBe(1);
  });

  it("scales a wave's regulars by the node's threat multiplier and fields the node's extra elites", () => {
    const c = new SurvivalRunController(1);
    c.beginWave();
    const base = c.scaledWaveSize(1, 1, 0);
    const hard = c.scaledWaveSize(1, 3, 2);
    expect(hard.enemyCount).toBeGreaterThan(base.enemyCount);
    expect(hard.eliteCount).toBe(2);
  });

  it("fields only the node's elites: no threat elites, no boss-wave bonus elite", () => {
    const c = new SurvivalRunController(1);
    for (let i = 0; i < 40; i++) c.beginWave();
    while (!c.isMilestone) c.beginWave();
    expect(c.waveSize(6).eliteCount).toBeGreaterThan(1);
    expect(c.scaledWaveSize(6, 3, 0).eliteCount).toBe(0);
    expect(c.scaledWaveSize(6, 3, 1).eliteCount).toBe(1);
  });
});

describe("SurvivalRunController regular-ship cap", () => {
  it("never fields more regulars than the node allows", () => {
    const c = new SurvivalRunController(1);
    for (let i = 0; i < 20; i++) c.beginWave();
    expect(c.scaledWaveSize(6, 2, 0, 4).enemyCount).toBe(4);
  });
});

describe("SurvivalRunController elite nodes", () => {
  it("trades regulars for the node's extra elites, down to the elites alone", () => {
    const c = new SurvivalRunController(1);
    for (let i = 0; i < 20; i++) c.beginWave();
    const plain = c.scaledWaveSize(2, 1, 0);
    const elite = c.scaledWaveSize(2, 1, 1, 40, 2);
    expect(elite.enemyCount).toBe(Math.max(0, plain.enemyCount - 2));
    expect(elite.eliteCount).toBe(1);
    expect(
      new SurvivalRunController(1).scaledWaveSize(1, 1, 3, 40, 2).enemyCount,
    ).toBe(0);
  });

  it("keeps at least one regular in a wave without elites", () => {
    expect(
      new SurvivalRunController(1).scaledWaveSize(1, 0.01, 0).enemyCount,
    ).toBe(1);
  });
});
