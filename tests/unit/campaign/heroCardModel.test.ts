/**
 * Spec: the hero card describes the hero's two powers per tab — overview
 * (key, name, rank), effects (what each rank does, in numbers) and lore.
 */

import { describe, expect, it } from "vitest";
import { FACTION_HEROES } from "../../../src/data/campaign/heroPowers";
import {
  heroLoreLines,
  heroOverview,
  powerRankLines,
  powerTermId,
  powerTooltip,
  slotTooltip,
} from "../../../src/ui/campaign/heroCardModel";
import { termEntry } from "../../../src/data/tooltips";

const CHEN = FACTION_HEROES.terran_hegemony;

describe("heroOverview", () => {
  it("shows key, glyph, name and rank of an unlocked power", () => {
    const view = heroOverview(CHEN, { orbital_strike: 2 });
    expect(view.powers[0]?.line).toBe("[V]  \u2738  ORBITAL STRIKE \u00b7 RANK II");
    expect(view.powers[0]?.locked).toBe(false);
  });

  it("shows how many missions unlock a locked power", () => {
    const view = heroOverview(CHEN, {});
    expect(view.powers[1]?.line).toContain("LOCKED \u00b7 3 MISSIONS");
    expect(view.powers[1]?.locked).toBe(true);
  });
});

describe("powerRankLines", () => {
  it("gives one numeric line per rank, recharge first", () => {
    const lines = powerRankLines(CHEN.powers[0]);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("I \u00b7 30 s \u00b7 30 dmg \u00b7 160 radius");
    expect(lines[2]).toContain("22 s");
  });

  it("describes every power of every faction without gaps", () => {
    for (const hero of Object.values(FACTION_HEROES))
      for (const power of hero.powers)
        for (const line of powerRankLines(power)) {
          expect(line).not.toMatch(/undefined|NaN/);
          expect(line.split(" \u00b7 ").length).toBeGreaterThanOrEqual(3);
        }
  });
});

describe("power tooltips", () => {
  it("explains the key, the rank or lock state and gives an example", () => {
    const [first, second] = heroOverview(CHEN, { orbital_strike: 1 }).powers;
    const ranked = powerTooltip(first!);
    expect(ranked.howItPlays).toContain("Cast with V (gamepad Y)");
    expect(ranked.howItPlays).toContain("three ranks");
    expect(ranked.example).toBeTruthy();
    expect(powerTooltip(second!).howItPlays).toContain("Cast with B (gamepad L3)");
    expect(powerTooltip(second!).howItPlays).toContain("not available yet");
  });

  it("has a catalog term for every power", () => {
    for (const hero of Object.values(FACTION_HEROES))
      for (const power of hero.powers) {
        expect(powerTermId(power), power.id).not.toBe("campaign.hero_key");
        expect(termEntry(powerTermId(power)).title, power.id).toBeTruthy();
      }
  });
});

describe("heroLoreLines", () => {
  it("returns the campaign description and the protagonist line", () => {
    const lore = heroLoreLines({
      description: "A war.",
      protagonist: "Cadet \u2192 Admiral",
    });
    expect(lore).toEqual({ story: "A war.", cast: "Cadet \u2192 Admiral" });
  });
});

describe("slotTooltip", () => {
  it("adds the remaining recharge to a power that is cooling down", () => {
    const tip = slotTooltip(CHEN.powers[0], 0, 1, 12);
    expect(tip.howItPlays).toContain("Recharging: 12 s left.");
    expect(tip.howItPlays).toContain("Cast with V");
  });

  it("says nothing about recharging when ready or locked", () => {
    expect(slotTooltip(CHEN.powers[0], 0, 1, 0).howItPlays).not.toContain("Recharging");
    expect(slotTooltip(CHEN.powers[1], 1, 0, 0).howItPlays).toContain("not available yet");
  });
});
