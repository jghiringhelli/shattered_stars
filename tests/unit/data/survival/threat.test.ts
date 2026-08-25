import { describe, it, expect } from "vitest";
import { createRunState } from "../../../../src/data/survival/model";
import {
  computeThreat,
  sizeWave,
  totalInvestment,
  MAX_ENEMIES,
} from "../../../../src/data/survival/threat";

describe("survival/threat", () => {
  it("sums branch investment", () => {
    const s = createRunState();
    s.branch.gunnery = 2;
    s.branch.drive = 3;
    expect(totalInvestment(s)).toBe(5);
  });

  it("threat rises with level, investment, escorts and ship count", () => {
    const base = createRunState();
    const t0 = computeThreat(base, 1);

    const leveled = createRunState();
    leveled.level = 5;
    expect(computeThreat(leveled, 1)).toBeGreaterThan(t0);

    const bigger = createRunState();
    expect(computeThreat(bigger, 4)).toBeGreaterThan(t0);

    const escorted = createRunState();
    escorted.escorts = 3;
    expect(computeThreat(escorted, 1)).toBeGreaterThan(t0);
  });

  it("sizeWave clamps enemy count to at least 1 and at most MAX_ENEMIES", () => {
    expect(sizeWave(0).enemyCount).toBe(1);
    expect(sizeWave(1000).enemyCount).toBe(MAX_ENEMIES);
  });

  it("a boss wave adds one elite", () => {
    const threat = 30;
    const normal = sizeWave(threat, false);
    const boss = sizeWave(threat, true);
    expect(boss.eliteCount).toBe(normal.eliteCount + 1);
  });
});
