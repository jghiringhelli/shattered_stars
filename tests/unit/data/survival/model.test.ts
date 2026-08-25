import { describe, it, expect } from "vitest";
import {
  createRunState,
  emptyBonuses,
  isMilestoneLevel,
  isBranchAmplified,
  BRANCHES,
  HULL_BRANCH_BIAS,
} from "../../../../src/data/survival/model";

describe("survival/model", () => {
  it("creates a zeroed run state starting on the workhorse hull", () => {
    const s = createRunState();
    expect(s.level).toBe(0);
    expect(s.hull).toBe("workhorse");
    expect(s.escorts).toBe(0);
    expect(s.rerolls).toBe(0);
    expect(s.taken).toEqual([]);
    for (const b of BRANCHES) expect(s.branch[b]).toBe(0);
  });

  it("emptyBonuses has every stat at zero", () => {
    const b = emptyBonuses();
    expect(Object.values(b).every((v) => v === 0)).toBe(true);
  });

  it("treats every 5th level (and only those) as a milestone", () => {
    expect(isMilestoneLevel(0)).toBe(false);
    expect(isMilestoneLevel(4)).toBe(false);
    expect(isMilestoneLevel(5)).toBe(true);
    expect(isMilestoneLevel(10)).toBe(true);
    expect(isMilestoneLevel(11)).toBe(false);
  });

  it("reports the two branches each hull amplifies", () => {
    for (const [hull, [a, b]] of Object.entries(HULL_BRANCH_BIAS)) {
      const h = hull as keyof typeof HULL_BRANCH_BIAS;
      expect(isBranchAmplified(h, a)).toBe(true);
      expect(isBranchAmplified(h, b)).toBe(true);
    }
    expect(isBranchAmplified("ace", "bulwark")).toBe(false);
  });
});
