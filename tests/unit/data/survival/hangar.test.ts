import { describe, it, expect } from "vitest";
import {
  createRunState,
  HULL_BRANCH_BIAS,
} from "../../../../src/data/survival/model";
import {
  hangarOptions,
  applyGraduate,
  applyEvolve,
  GRADUATION,
} from "../../../../src/data/survival/hangar";

describe("survival/hangar", () => {
  it("offers a graduation lane per adjacent hull plus evolve (no escort)", () => {
    const s = createRunState(); // workhorse -> [ace, gunboat]
    const opts = hangarOptions(s);
    const graduate = opts
      .filter((o) => o.kind === "graduate")
      .map((o) => o.hull);
    expect(graduate).toEqual([...GRADUATION.workhorse]);
    expect(opts.some((o) => o.kind === "evolve")).toBe(true);
    expect(opts.some((o) => (o.kind as string) === "escort")).toBe(false);
  });

  it("graduates only to an adjacent hull", () => {
    const s = createRunState();
    applyGraduate(s, "capital"); // not adjacent to workhorse
    expect(s.hull).toBe("workhorse");
    applyGraduate(s, "ace"); // adjacent
    expect(s.hull).toBe("ace");
  });

  it("evolve deepens the current hull's two amplified branches", () => {
    const s = createRunState("gunboat");
    applyEvolve(s);
    for (const b of HULL_BRANCH_BIAS.gunboat) {
      expect(s.branch[b]).toBe(1);
    }
  });

  it("the capital hull is a terminal graduation lane", () => {
    expect(GRADUATION.capital).toHaveLength(0);
  });
});
