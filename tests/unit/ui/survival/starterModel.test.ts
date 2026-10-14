import { describe, it, expect } from "vitest";
import {
  ascensionTip,
  buildSelection,
  starterCardRects,
} from "../../../../src/ui/survival/starterModel";
import {
  quickBuildOptions,
  selectionFor,
} from "../../../../src/arcade/systems/QuickBuildChoice";

describe("starter cards", () => {
  it("centres the row and keeps every card the same size", () => {
    const rects = starterCardRects(3, 1280);
    expect(rects).toHaveLength(3);
    expect(new Set(rects.map((r) => r.width)).size).toBe(1);
    const first = rects[0]!;
    const last = rects[2]!;
    expect(first.x - first.width / 2).toBeCloseTo(
      1280 - (last.x + last.width / 2),
    );
  });

  it("shrinks the cards so a long row never leaves the screen", () => {
    const rects = starterCardRects(5, 1280);
    const right = rects[4]!.x + rects[4]!.width / 2;
    expect(right).toBeLessThanOrEqual(1280);
    expect(rects[0]!.width).toBeLessThan(starterCardRects(2, 1280)[0]!.width + 1);
  });

  it("lays out nothing for no starters", () => {
    expect(starterCardRects(0, 1280)).toEqual([]);
  });
});

describe("flagship build pick", () => {
  it("keeps the build picked on the BUILDS tab for the chosen flagship", () => {
    const shipId = "terran_viper";
    const options = quickBuildOptions(shipId);
    expect(options.length).toBeGreaterThan(1);
    const pick = options[options.length - 1]!;
    const selection = selectionFor([shipId], buildSelection(shipId, pick));
    expect(selection.loadoutIds[0]).toBe(pick);
  });
});

describe("ascension tooltip", () => {
  it("lists the modifiers active at the chosen level", () => {
    const tip = ascensionTip(5, 5);
    expect(tip.title).toContain("Ascension 5");
    expect(tip.howItPlays).toContain("Hardened Hulls");
  });

  it("says a run at level 0 has no modifiers and how to unlock the next", () => {
    const tip = ascensionTip(0, 0);
    expect(tip.howItPlays).toMatch(/no modifiers/i);
    expect(tip.body!.length).toBeGreaterThan(20);
    expect(tip.example!.length).toBeGreaterThan(10);
  });
});
