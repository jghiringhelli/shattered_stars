/**
 * Spec: armory mods and research options are described as plain facts
 * (each tied to a tooltip term) and explained by a tooltip with a definition
 * and an example.
 */

import { describe, expect, it } from "vitest";
import { ARMORY_MODS } from "../../../src/data/campaign/armory";
import { RESEARCH_TREE } from "../../../src/data/campaign/research";
import { termEntry } from "../../../src/data/tooltips";
import {
  bonusFacts,
  effectTooltip,
} from "../../../src/ui/campaign/bonusFacts";

describe("bonusFacts", () => {
  it("states a multiplier as a percentage", () => {
    expect(bonusFacts({ hullMultiplier: 1.2 })).toEqual([
      { label: "+20% hull", term: "campaign.bonus_hull" },
    ]);
    expect(bonusFacts({ damageTakenMultiplier: 0.88 })[0]?.label).toBe(
      "-12% damage taken",
    );
    expect(bonusFacts({ secondaryReloadMultiplier: 0.75 })[0]?.label).toBe(
      "25% faster ordnance and turrets",
    );
  });

  it("states additive bonuses with their unit", () => {
    expect(bonusFacts({ attackBonus: 1 })[0]?.label).toBe("+1 damage per hit");
    expect(bonusFacts({ agilityBonus: 0.5 })[0]?.label).toBe("+0.5 evasion");
    expect(bonusFacts({ shieldRegenPerSecond: 0.24 })[0]?.label).toBe(
      "+0.24 shield HP/s",
    );
  });

  it("lists every bonus of a mod with several effects", () => {
    const labels = bonusFacts({
      shieldMultiplier: 1.15,
      shieldRegenPerSecond: 0.24,
    }).map((fact) => fact.label);
    expect(labels).toEqual(["+15% shields", "+0.24 shield HP/s"]);
  });

  it("describes every armory mod and research option", () => {
    const bonuses = [
      ...ARMORY_MODS.map((mod) => mod.bonuses),
      ...RESEARCH_TREE.flatMap((tier) => [
        tier.optionA.bonuses,
        tier.optionB.bonuses,
      ]),
    ];
    for (const set of bonuses) expect(bonusFacts(set).length).toBeGreaterThan(0);
  });
});

describe("effectTooltip", () => {
  it("carries the mod text, the term definitions and an example", () => {
    const facts = bonusFacts({ hullMultiplier: 1.2 });
    const tip = effectTooltip("Reinforced Bulkheads", "+20% hull.", facts);
    expect(tip.title).toBe("Reinforced Bulkheads");
    expect(tip.body).toBe("+20% hull.");
    expect(tip.howItPlays).toContain(termEntry("campaign.bonus_hull").definition);
    expect(tip.example).toBe(termEntry("campaign.bonus_hull").example);
  });
});
