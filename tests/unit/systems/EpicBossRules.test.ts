/**
 * Unit tests for the pure Epic boss rules extracted from EpicBattleScene.
 * These lock the phase thresholds, phase-scaled damage/reinforcements, and
 * section-hull aggregation that drive the capital-assault fight.
 */

import { describe, it, expect } from "vitest";
import {
  bossPhaseForHullRatio,
  bossBroadsideDamage,
  bossReinforcementCount,
  sumSectionHull,
  BOSS_PHASE_2_HULL_RATIO,
  BOSS_PHASE_3_HULL_RATIO,
  type BossPhase,
} from "../../../src/systems/EpicBossRules";

describe("bossPhaseForHullRatio", () => {
  it("is phase 1 at full hull", () => {
    expect(bossPhaseForHullRatio(1)).toBe(1);
  });

  it("is phase 1 just above the phase-2 threshold", () => {
    expect(bossPhaseForHullRatio(BOSS_PHASE_2_HULL_RATIO + 0.01)).toBe(1);
  });

  it("enters phase 2 exactly at the phase-2 threshold", () => {
    expect(bossPhaseForHullRatio(BOSS_PHASE_2_HULL_RATIO)).toBe(2);
  });

  it("stays phase 2 just above the phase-3 threshold", () => {
    expect(bossPhaseForHullRatio(BOSS_PHASE_3_HULL_RATIO + 0.01)).toBe(2);
  });

  it("enters phase 3 exactly at the phase-3 threshold", () => {
    expect(bossPhaseForHullRatio(BOSS_PHASE_3_HULL_RATIO)).toBe(3);
  });

  it("is phase 3 at zero hull", () => {
    expect(bossPhaseForHullRatio(0)).toBe(3);
  });
});

describe("bossBroadsideDamage", () => {
  it("scales with phase (2 / 3 / 4)", () => {
    expect(bossBroadsideDamage(1)).toBe(2);
    expect(bossBroadsideDamage(2)).toBe(3);
    expect(bossBroadsideDamage(3)).toBe(4);
  });

  it("is strictly increasing across phases", () => {
    const phases: BossPhase[] = [1, 2, 3];
    const damage = phases.map(bossBroadsideDamage);
    expect(damage[0]!).toBeLessThan(damage[1]!);
    expect(damage[1]!).toBeLessThan(damage[2]!);
  });
});

describe("bossReinforcementCount", () => {
  it("launches 2 escorts before the critical phase", () => {
    expect(bossReinforcementCount(1)).toBe(2);
    expect(bossReinforcementCount(2)).toBe(2);
  });

  it("launches 3 escorts in the critical phase", () => {
    expect(bossReinforcementCount(3)).toBe(3);
  });
});

describe("sumSectionHull", () => {
  it("is zero for no sections", () => {
    expect(sumSectionHull([])).toBe(0);
  });

  it("sums remaining hull across sections", () => {
    expect(sumSectionHull([{ hull: 10 }, { hull: 5 }, { hull: 0 }])).toBe(15);
  });
});
