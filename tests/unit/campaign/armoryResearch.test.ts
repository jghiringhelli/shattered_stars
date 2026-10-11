/**
 * Armory (credits → campaign-only ship modifications, free respec) and
 * Research (research points → permanent mutually exclusive A/B choices)
 * rules, plus the aggregated bonuses they grant the squad.
 */

import { describe, expect, it } from "vitest";
import {
  installMod,
  installedInSlot,
  respecArmory,
  uninstallMod,
  type ArmoryLedger,
} from "../../../src/campaign/armory/armoryRules";
import {
  chooseResearch,
  unlockedResearchTiers,
} from "../../../src/campaign/armory/researchRules";
import { campaignBonuses } from "../../../src/campaign/armory/campaignBonuses";
import { ARMORY_MODS } from "../../../src/data/campaign/armory";
import { RESEARCH_TREE } from "../../../src/data/campaign/research";

const EMPTY: ArmoryLedger = { installed: {} };
const firstMod = ARMORY_MODS[0]!;
const rival = ARMORY_MODS.find(
  (m) => m.slot === firstMod.slot && m.id !== firstMod.id,
)!;

describe("armory data", () => {
  it("offers at least two mods for every slot", () => {
    const slots = new Map<string, number>();
    for (const mod of ARMORY_MODS)
      slots.set(mod.slot, (slots.get(mod.slot) ?? 0) + 1);
    expect([...slots.values()].every((n) => n >= 2)).toBe(true);
  });
});

describe("armory rules", () => {
  it("installs a mod when credits allow, charging its cost", () => {
    const result = installMod(1000, EMPTY, firstMod.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.credits).toBe(1000 - firstMod.cost);
    expect(installedInSlot(result.ledger, firstMod.slot)).toBe(firstMod.id);
  });

  it("refuses a mod the player cannot afford", () => {
    expect(installMod(firstMod.cost - 1, EMPTY, firstMod.id)).toEqual({
      ok: false,
      reason: "insufficient_credits",
    });
  });

  it("refuses an unknown mod", () => {
    expect(installMod(9999, EMPTY, "nope")).toEqual({
      ok: false,
      reason: "unknown_mod",
    });
  });

  it("swapping a slot refunds the mod it replaces", () => {
    const first = installMod(1000, EMPTY, firstMod.id);
    if (!first.ok) throw new Error("install failed");
    const swap = installMod(first.credits, first.ledger, rival.id);
    if (!swap.ok) throw new Error("swap failed");
    expect(swap.credits).toBe(1000 - rival.cost);
    expect(installedInSlot(swap.ledger, firstMod.slot)).toBe(rival.id);
  });

  it("uninstalling refunds the full price paid", () => {
    const first = installMod(1000, EMPTY, firstMod.id);
    if (!first.ok) throw new Error("install failed");
    const back = uninstallMod(first.credits, first.ledger, firstMod.id);
    expect(back).toEqual({ credits: 1000, ledger: EMPTY });
  });

  it("respec refunds every mod (free between missions)", () => {
    let credits = 2000;
    let ledger = EMPTY;
    for (const mod of ARMORY_MODS.filter(
      (m, i, all) => all.findIndex((o) => o.slot === m.slot) === i,
    )) {
      const r = installMod(credits, ledger, mod.id);
      if (!r.ok) throw new Error("install failed");
      ({ credits, ledger } = r);
    }
    expect(respecArmory(credits, ledger)).toEqual({
      credits: 2000,
      ledger: EMPTY,
    });
  });
});

describe("research rules", () => {
  it("has at least three binary tiers", () => {
    expect(RESEARCH_TREE.length).toBeGreaterThanOrEqual(3);
    for (const tier of RESEARCH_TREE)
      expect(tier.optionA.id).not.toBe(tier.optionB.id);
  });

  it("unlocks tiers as research points are earned", () => {
    expect(unlockedResearchTiers(0)).toHaveLength(0);
    const first = RESEARCH_TREE[0]!;
    expect(
      unlockedResearchTiers(first.requiredPoints).map((t) => t.id),
    ).toEqual([first.id]);
  });

  it("records a choice for an unlocked tier", () => {
    const tier = RESEARCH_TREE[0]!;
    expect(chooseResearch({}, tier.requiredPoints, tier.id, "A")).toEqual({
      ok: true,
      choices: { [tier.id]: "A" },
    });
  });

  it("refuses a locked tier", () => {
    const tier = RESEARCH_TREE[0]!;
    expect(chooseResearch({}, tier.requiredPoints - 1, tier.id, "A")).toEqual({
      ok: false,
      reason: "locked",
    });
  });

  it("makes the choice permanent (no switching to the other option)", () => {
    const tier = RESEARCH_TREE[0]!;
    expect(chooseResearch({ [tier.id]: "A" }, 99, tier.id, "B")).toEqual({
      ok: false,
      reason: "already_chosen",
    });
  });
});

describe("campaignBonuses", () => {
  it("is neutral with nothing installed or researched", () => {
    const bonuses = campaignBonuses(EMPTY, {});
    expect(bonuses.hullMultiplier).toBe(1);
    expect(bonuses.attackBonus).toBe(0);
    expect(bonuses.powerCooldownMultiplier).toBe(1);
  });

  it("stacks armory and research bonuses (multipliers multiply)", () => {
    const hullMod = ARMORY_MODS.find(
      (m) => (m.bonuses.hullMultiplier ?? 1) > 1,
    )!;
    const hullTier = RESEARCH_TREE.find(
      (t) => (t.optionA.bonuses.hullMultiplier ?? 1) > 1,
    )!;
    const bonuses = campaignBonuses(
      { installed: { [hullMod.id]: hullMod.cost } },
      { [hullTier.id]: "A" },
    );
    expect(bonuses.hullMultiplier).toBeCloseTo(
      hullMod.bonuses.hullMultiplier! *
        hullTier.optionA.bonuses.hullMultiplier!,
    );
  });
});
