/**
 * Save schema v4 — migration of v3 saves (slot added, nothing lost), the
 * Coalition slot, the Chronicle's validation and corrupt backup, and seeding
 * the Chronicle from the faction saves that already exist.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { migrateChronicle } from "../../../src/campaign/chronicle/chronicleSchema";
import { createCoalitionSave } from "../../../src/campaign/coalition/coalitionLaunch";
import { migrateCampaignSave } from "../../../src/campaign/save/campaignSaveSchema";
import { CampaignSaveManager } from "../../../src/systems/CampaignSaveManager";
import {
  CHRONICLE_CORRUPT_SUFFIX,
  CHRONICLE_KEY,
  ChronicleManager,
} from "../../../src/systems/ChronicleManager";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

/** A save exactly as v3 wrote it (no slot). */
const V3_SAVE = {
  version: 3,
  factionId: "free_confederation",
  currentMission: 3,
  completedMissions: ["conf_1_1", "conf_1_2"],
  totalXp: 200,
  credits: 120,
  totalKills: 4,
  shipsLost: 0,
  unlockedShips: [],
  lastPlayed: 1_700_000_000_000,
  campaignPilots: [],
  pendingEvolution: false,
  storyFlags: { conf_crash_data: true },
  branchChoices: {},
  researchPoints: 2,
  research: { tier_1: "A" },
  armory: { installed: { hull_1: 150 } },
  heroPowerRanks: { rally_the_fleet: 1 },
  bonusObjectivesCompleted: ["conf_1_1:fast"],
  campaignComplete: false,
};

beforeEach(() => store.clear());

describe("campaign save v3 → v4", () => {
  it("adds the slot and keeps every v3 field", () => {
    const save = migrateCampaignSave(V3_SAVE, "free_confederation")!;
    expect(save.version).toBe(4);
    expect(save.slot).toBe("free_confederation");
    const { version: _v, ...v3Fields } = V3_SAVE;
    expect(save).toMatchObject(v3Fields);
  });

  it("stores a Coalition save under its own slot, leaving the faction save alone", () => {
    CampaignSaveManager.save(
      CampaignSaveManager.createNew("free_confederation"),
    );
    const base = CampaignSaveManager.createNew("void_corsairs");
    const coalition = createCoalitionSave("void_corsairs", base, null);
    CampaignSaveManager.save(coalition);
    expect(store.has("shattered_stars_campaign_coalition")).toBe(true);
    const loaded = CampaignSaveManager.load("coalition")!;
    expect(loaded.slot).toBe("coalition");
    expect(loaded.factionId).toBe("void_corsairs");
    expect(CampaignSaveManager.load("free_confederation")!.slot).toBe(
      "free_confederation",
    );
  });

  it("carries the lead's credits and research into the Coalition save", () => {
    const leadSave = migrateCampaignSave(V3_SAVE, "free_confederation")!;
    const base = CampaignSaveManager.createNew("free_confederation");
    const coalition = createCoalitionSave("free_confederation", base, leadSave);
    expect(coalition).toMatchObject({
      credits: 120,
      researchPoints: 2,
      research: { tier_1: "A" },
      armory: { installed: { hull_1: 150 } },
    });
    expect(coalition.completedMissions).toEqual([]);
  });
});

describe("Chronicle schema and storage", () => {
  it("rejects a non-object and defaults malformed fields", () => {
    expect(migrateChronicle(null)).toBeNull();
    const chronicle = migrateChronicle({
      flags: {
        x7_shards_saved: true,
        not_shared: true,
        x8_node_preserved: "yes",
      },
      crossovers: { X4: { canonFaction: "nobody" }, X99: {} },
      actsComplete: { terran_hegemony: [2, 1, "x", 1] },
      freeOrder: "true",
      ending: "nonsense",
    })!;
    expect(chronicle.flags).toEqual({ x7_shards_saved: true });
    expect(chronicle.crossovers).toEqual({});
    expect(chronicle.actsComplete["terran_hegemony"]).toEqual([1, 2]);
    expect(chronicle.freeOrder).toBe(false);
    expect(chronicle.ending).toBeNull();
  });

  it("seeds from existing faction saves on first load and stores it", () => {
    store.set(
      "shattered_stars_campaign_free_confederation",
      JSON.stringify({
        ...V3_SAVE,
        completedMissions: [
          "conf_1_1",
          "conf_1_2",
          "conf_1_3",
          "conf_1_4",
          "conf_1_5",
        ],
        storyFlags: { x1_census_burned: true },
      }),
    );
    const chronicle = ChronicleManager.load();
    expect(chronicle.actsComplete["free_confederation"]).toEqual([1]);
    expect(chronicle.flags["x1_census_burned"]).toBe(true);
    expect(chronicle.crossovers["X1"]?.canonFaction).toBe("free_confederation");
    expect(store.has(CHRONICLE_KEY)).toBe(true);
  });

  it("backs up an unreadable Chronicle and starts over", () => {
    store.set(CHRONICLE_KEY, "{not json");
    const chronicle = ChronicleManager.load();
    expect(chronicle.flags).toEqual({});
    expect(store.get(CHRONICLE_KEY + CHRONICLE_CORRUPT_SUFFIX)).toBe(
      "{not json",
    );
  });

  it("round-trips Free Order and refuses a disallowed ending", () => {
    ChronicleManager.setFreeOrder(true);
    expect(ChronicleManager.load().freeOrder).toBe(true);
    expect(ChronicleManager.chooseEnding("answer").ending).toBeNull();
    expect(ChronicleManager.chooseEnding("quiet").ending).toBe("quiet");
    expect(ChronicleManager.load().ending).toBe("quiet");
  });

  it("switches Free Order on after the first ending", () => {
    expect(ChronicleManager.load().freeOrder).toBe(false);
    ChronicleManager.chooseEnding("quiet");
    expect(ChronicleManager.load().freeOrder).toBe(true);
  });

  it("allows Answer when a key is derived from its source flag", () => {
    const flags = Object.fromEntries(
      [
        "x5_joint_breakout",
        "heg_phoenix_defected",
        "x7_shards_saved",
        "x8_node_preserved",
        "x10_chen_held_fire",
        "x11_betrayal_averted",
        "x12_sanctuary_reached",
        "key_conf_pact",
        "key_synth_dissent",
        "key_cors_loyalty",
        "key_asc_mercy",
      ].map((f) => [f, true]),
    );
    ChronicleManager.save({ ...ChronicleManager.load(), flags });
    expect(ChronicleManager.chooseEnding("answer").ending).toBe("answer");
  });
});
