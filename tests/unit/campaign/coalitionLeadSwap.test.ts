/**
 * Coalition lead swap (docs/specs/campaign.md §11): the pure swap, its save
 * round trip and the hub model of the lead control.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COALITION_LEADS,
  createCoalitionSave,
  switchCoalitionLead,
} from "../../../src/campaign/coalition/coalitionLaunch";
import { CampaignSaveManager } from "../../../src/systems/CampaignSaveManager";
import { FACTION_HEROES } from "../../../src/data/campaign/heroPowers";
import { heroPowerRanksFor } from "../../../src/campaign/powers/heroPowerState";
import { coalitionLeadOptions } from "../../../src/ui/campaign/coalitionLeadModel";

const VETERAN_MISSIONS = 15;

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
});

function coalitionAs(lead: (typeof COALITION_LEADS)[number]) {
  const base = CampaignSaveManager.createNew(lead, [], "coalition");
  return createCoalitionSave(lead, base, null);
}

describe("switchCoalitionLead", () => {
  it("changes the lead faction and gives the new hero veteran ranks", () => {
    const next = switchCoalitionLead(coalitionAs("terran_hegemony"), "void_corsairs");
    expect(next.factionId).toBe("void_corsairs");
    expect(next.slot).toBe("coalition");
    expect(next.heroPowerRanks).toEqual(
      heroPowerRanksFor("void_corsairs", VETERAN_MISSIONS),
    );
  });

  it("keeps the shared progress: credits, research, armory, flags, missions", () => {
    const before = {
      ...coalitionAs("terran_hegemony"),
      credits: 340,
      researchPoints: 3,
      research: { tier_1: "A" as const },
      armory: { installed: { hull_1: 150 } },
      storyFlags: { x7_shards_saved: true },
      completedMissions: ["coal_4_1", "coal_4_2"],
      campaignComplete: false,
    };
    const next = switchCoalitionLead(before, "ascendant_empire");
    expect(next).toMatchObject({
      credits: 340,
      researchPoints: 3,
      research: { tier_1: "A" },
      armory: { installed: { hull_1: 150 } },
      storyFlags: { x7_shards_saved: true },
      completedMissions: ["coal_4_1", "coal_4_2"],
    });
  });

  it("does not change the save it is given", () => {
    const before = coalitionAs("terran_hegemony");
    const snapshot = JSON.stringify(before);
    switchCoalitionLead(before, "free_confederation");
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("returns an equal save when the hero already leads", () => {
    const before = coalitionAs("synthetic_collective");
    expect(switchCoalitionLead(before, "synthetic_collective")).toEqual(before);
  });

  it("never lowers a rank when swapping back to a hero", () => {
    const first = coalitionAs("terran_hegemony");
    const there = switchCoalitionLead(first, "free_confederation");
    const back = switchCoalitionLead(there, "terran_hegemony");
    expect(back.heroPowerRanks).toEqual(first.heroPowerRanks);
  });

  it("refuses a swap outside the Coalition", () => {
    const faction = CampaignSaveManager.createNew("terran_hegemony");
    expect(() => switchCoalitionLead(faction, "void_corsairs")).toThrow(
      /coalition/i,
    );
  });
});

describe("lead swap save round trip", () => {
  beforeEach(() => store.clear());

  it("loads a swapped Coalition save with the new lead and its ranks", () => {
    const swapped = switchCoalitionLead(coalitionAs("terran_hegemony"), "void_corsairs");
    CampaignSaveManager.save(swapped);
    const loaded = CampaignSaveManager.load("coalition")!;
    expect(loaded.version).toBe(4);
    expect(loaded.factionId).toBe("void_corsairs");
    expect(loaded.heroPowerRanks).toEqual(swapped.heroPowerRanks);
  });
});

describe("coalitionLeadOptions", () => {
  it("lists the five heroes in order and marks only the current lead", () => {
    const options = coalitionLeadOptions("free_confederation");
    expect(options.map((o) => o.faction)).toEqual([...COALITION_LEADS]);
    expect(options.filter((o) => o.current).map((o) => o.faction)).toEqual([
      "free_confederation",
    ]);
  });

  it("names the hero and the two powers each lead puts on the bar", () => {
    for (const option of coalitionLeadOptions("terran_hegemony")) {
      const hero = FACTION_HEROES[option.faction];
      expect(option.heroName).toBe(hero.name);
      expect(option.portraitKey).toBe(hero.portraitKey);
      expect(option.powerNames).toEqual(hero.powers.map((p) => p.name));
    }
  });

  it("explains in the tooltip what a swap changes, and that the lead flies now", () => {
    const [heg, conf] = coalitionLeadOptions("terran_hegemony");
    expect(conf!.tooltip.body).toContain(conf!.powerNames[0]);
    expect(conf!.tooltip.body).toContain(conf!.powerNames[1]);
    expect(conf!.tooltip.body.toLowerCase()).toContain("next mission");
    expect(heg!.tooltip.body.toLowerCase()).toContain("leads");
  });
});
