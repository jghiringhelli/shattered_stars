/**
 * hubActions — Armory and Research actions the hub applies to a campaign
 * save (pure; the scene persists the result).
 */

import { describe, expect, it } from "vitest";
import {
  pickResearch,
  respecArmory,
  toggleArmoryMod,
} from "../../../src/campaign/hub/hubActions";
import { CampaignSaveManager } from "../../../src/systems/CampaignSaveManager";

const rich = {
  ...CampaignSaveManager.createNew("terran_hegemony"),
  credits: 1000,
  researchPoints: 3,
};

describe("hubActions", () => {
  it("buys a mod, then refunds it on a second toggle", () => {
    const bought = toggleArmoryMod(rich, "capacitor_array");
    expect(bought.ok).toBe(true);
    expect(bought.save.credits).toBe(850);
    expect(bought.save.armory.installed).toEqual({ capacitor_array: 150 });
    const refunded = toggleArmoryMod(bought.save, "capacitor_array");
    expect(refunded.save.credits).toBe(1000);
    expect(refunded.save.armory.installed).toEqual({});
  });

  it("reports a refused purchase without changing the save", () => {
    const poor = { ...rich, credits: 10 };
    const result = toggleArmoryMod(poor, "capacitor_array");
    expect(result).toMatchObject({ ok: false, reason: "insufficient_credits" });
    expect(result.save).toBe(poor);
  });

  it("respecs the whole armory for free", () => {
    const a = toggleArmoryMod(rich, "capacitor_array").save;
    const b = toggleArmoryMod(a, "rapid_cyclers").save;
    expect(respecArmory(b)).toMatchObject({
      credits: 1000,
      armory: { installed: {} },
    });
  });

  it("records a permanent research pick for an unlocked tier", () => {
    const result = pickResearch(rich, "hull_doctrine", "B");
    expect(result.ok).toBe(true);
    expect(result.save.research).toEqual({ hull_doctrine: "B" });
    expect(pickResearch(result.save, "hull_doctrine", "A")).toMatchObject({
      ok: false,
      reason: "already_chosen",
    });
  });
});
