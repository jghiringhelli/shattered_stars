/**
 * Spec: the builds tab splits one build's explanation into two columns —
 * what it is for / example / best with / counter on the left, how to fly and
 * strengths / weaknesses on the right — capped so it fits, plus a one-line
 * cost summary that adds up to the build's total.
 */

import { describe, it, expect } from "vitest";
import { explainQuickBuild } from "../../../../src/data/roleHints";
import { getEquippableLoadouts } from "../../../../src/data/ShipLoadouts";
import {
  buildsSections,
  costSummary,
  BUILDS_CAPS,
  NARROW_BUILDS_CAPS,
} from "../../../../src/ui/picker/guideSections";

const loadout = getEquippableLoadouts("terran_gladius")[0]!;

describe("buildsSections", () => {
  const guide = explainQuickBuild(loadout);
  const { left, right } = buildsSections(guide);

  it("puts purpose, example, best-with and counter on the left", () => {
    expect(left.map((s) => s.heading)).toEqual([
      "WHEN TO PICK IT",
      "EXAMPLE",
      "BEST WITH",
      "COUNTERED BY",
    ]);
  });

  it("puts how to fly, strengths and weaknesses on the right", () => {
    expect(right.map((s) => s.heading)).toEqual([
      "HOW TO FLY",
      "STRENGTHS",
      "WEAKNESSES",
    ]);
  });

  it("caps the bullet lists", () => {
    expect(right[0]!.lines.length).toBeLessThanOrEqual(BUILDS_CAPS.howToFly);
    expect(right[1]!.lines.length).toBeLessThanOrEqual(BUILDS_CAPS.pros);
    expect(right[2]!.lines.length).toBeLessThanOrEqual(BUILDS_CAPS.cons);
  });
});

describe("buildsSections (narrow panel)", () => {
  it("drops best-with and counter and trims the lists to fit", () => {
    const { left, right } = buildsSections(explainQuickBuild(loadout), true);
    expect(left.map((s) => s.heading)).toEqual(["WHEN TO PICK IT", "EXAMPLE"]);
    expect(right[0]!.lines.length).toBeLessThanOrEqual(NARROW_BUILDS_CAPS.howToFly);
    expect(right[1]!.lines.length).toBeLessThanOrEqual(NARROW_BUILDS_CAPS.pros);
    expect(right[2]!.lines.length).toBeLessThanOrEqual(NARROW_BUILDS_CAPS.cons);
  });
});

describe("costSummary", () => {
  it("lists every cost line and ends with the total", () => {
    const guide = explainQuickBuild(loadout);
    const text = costSummary(guide);
    expect(text.endsWith(`= ${guide.totalPoints} pt`)).toBe(true);
    const sum = guide.costLines.reduce((s, l) => s + l.points, 0);
    expect(sum).toBe(guide.totalPoints);
  });
});
