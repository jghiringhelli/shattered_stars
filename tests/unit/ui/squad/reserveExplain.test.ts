import { describe, expect, it } from "vitest";
import {
  poolCapTooltip,
  quotaSentence,
  reserveSummaryLine,
  selectionAfterMove,
  selectionAfterRemove,
} from "../../../../src/ui/squad/reserveExplain";
import { rulesFor } from "../../../../src/arcade/reinforcements";

describe("quotaSentence", () => {
  it("spells out the skirmish quotas in plain words", () => {
    const text = quotaSentence(rulesFor("skirmish"));
    expect(text).toContain("up to 4 bombers");
    expect(text).toContain("up to 2 aces");
    expect(text).toContain("9 per match");
    expect(text).toContain("no capital ships");
  });

  it("allows capital ships in epic", () => {
    const text = quotaSentence(rulesFor("epic"));
    expect(text).toContain("up to 1 capital ship");
    expect(text).not.toContain("no capital ships");
  });
});

describe("reserveSummaryLine", () => {
  it("counts ships and points", () => {
    expect(reserveSummaryLine(9, 612)).toBe("9 ships \u00b7 612 pt in reserve");
  });

  it("uses the singular for one ship", () => {
    expect(reserveSummaryLine(1, 40)).toBe("1 ship \u00b7 40 pt in reserve");
  });

  it("says so when the reserve is empty", () => {
    expect(reserveSummaryLine(0, 0)).toBe("Reserve is empty");
  });
});

describe("selection after an edit", () => {
  it("follows a moved row and stays in range", () => {
    expect(selectionAfterMove(2, -1, 5)).toBe(1);
    expect(selectionAfterMove(0, -1, 5)).toBe(0);
    expect(selectionAfterMove(4, 1, 5)).toBe(4);
  });

  it("moves to the next row when one is removed, or clears when none are left", () => {
    expect(selectionAfterRemove(1, 3)).toBe(1);
    expect(selectionAfterRemove(2, 2)).toBe(1);
    expect(selectionAfterRemove(0, 0)).toBeNull();
  });
});

describe("poolCapTooltip", () => {
  it("combines the pool and cap sentences with an example", () => {
    const tip = poolCapTooltip(1000, 250);
    expect(tip.body).toContain("Pool 1000");
    expect(tip.body).toContain("On-field cap 250");
    expect(tip.example && tip.example.length).toBeGreaterThan(10);
  });
});
