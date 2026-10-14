/**
 * Spec: the points budget turns spent / limit into plain-language numbers
 * (spent, left, over) and refuses a pick that goes over the limit with a
 * reason a new player understands; reinforcement pools get their own text.
 */

import { describe, it, expect } from "vitest";
import {
  budgetCaption,
  budgetOf,
  checkAddToBudget,
  fieldCapNote,
  poolNote,
  wingmenCaption,
} from "../../../../src/ui/picker/pointsBudget";

describe("budgetOf", () => {
  it("computes remaining points and the filled fraction", () => {
    const budget = budgetOf(130, 200);
    expect(budget).toMatchObject({ spent: 130, limit: 200, remaining: 70, over: false });
    expect(budget.fraction).toBeCloseTo(0.65);
  });

  it("flags a squad over the limit and clamps the bar at full", () => {
    const budget = budgetOf(215, 200);
    expect(budget.over).toBe(true);
    expect(budget.remaining).toBe(-15);
    expect(budget.fraction).toBe(1);
  });

  it("treats a zero limit as an empty bar, not a division by zero", () => {
    expect(budgetOf(0, 0).fraction).toBe(0);
  });
});

describe("budgetCaption", () => {
  it("says spent, left and the limit", () => {
    expect(budgetCaption(budgetOf(130, 200))).toBe("130 spent \u00b7 70 left of 200");
  });

  it("says how far over the limit a squad is", () => {
    expect(budgetCaption(budgetOf(215, 200))).toBe("215 spent \u00b7 15 over the limit of 200");
  });
});

describe("checkAddToBudget", () => {
  it("accepts a pick that fits exactly", () => {
    expect(checkAddToBudget(155, 45, 200)).toEqual({ ok: true });
  });

  it("refuses a pick that does not fit and names the shortfall", () => {
    const verdict = checkAddToBudget(170, 45, 200);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain("45");
    expect(verdict.reason).toContain("30 pts left");
    expect(verdict.reason.toLowerCase()).toContain("over budget");
  });

  it("explains the cheapest alternative when one is given", () => {
    const verdict = checkAddToBudget(170, 45, 200, 25);
    if (verdict.ok) throw new Error("expected a refusal");
    expect(verdict.reason).toContain("cheapest ship is 25 pts");
  });
});

describe("wingmenCaption", () => {
  it("explains how the rest of the budget is filled in the simple flow", () => {
    expect(wingmenCaption(59, 197, 200)).toBe(
      "Your ship 59 pts + AI wingmen 138 pts = 197 of 200",
    );
  });

  it("reads plainly when the ship has no wingmen", () => {
    expect(wingmenCaption(59, 59, 200)).toBe("Your ship 59 pts of 200 \u2014 no wingmen fit");
  });
});

describe("reinforcement notes", () => {
  it("explains the pool", () => {
    expect(poolNote(1000)).toBe(
      "Pool 1000: every ship you deploy spends points; the battle ends when the pool is empty",
    );
  });

  it("explains the on-field cap", () => {
    expect(fieldCapNote(250)).toBe(
      "On-field cap 250: at most 250 flown points in play at once; the rest wait in reserve",
    );
  });
});
