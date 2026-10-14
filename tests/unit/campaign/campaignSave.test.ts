/**
 * Campaign save v3 — integrity: migration from v1/v2 without data loss,
 * validation of malformed fields, corrupt-JSON backup, mission completion
 * (flags, branch choice, bonus research once, hero unlocks, completion) and
 * a save → reload round trip.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { migrateCampaignSave } from "../../../src/campaign/save/campaignSaveSchema";
import { applyMissionCompletion } from "../../../src/campaign/save/missionCompletion";
import {
  CORRUPT_BACKUP_SUFFIX,
  CampaignSaveManager,
} from "../../../src/systems/CampaignSaveManager";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

/** A save exactly as v2 wrote it. */
const V2_SAVE = {
  version: 2,
  factionId: "terran_hegemony",
  currentMission: 4,
  completedMissions: ["heg_1_1", "heg_1_2", "heg_1_3"],
  totalXp: 400,
  credits: 325,
  totalKills: 9,
  shipsLost: 1,
  unlockedShips: ["terran_raptor"],
  lastPlayed: 1_700_000_000_000,
  campaignPilots: [
    {
      pilotId: "admiral_chen",
      currentShipId: "terran_raptor",
      pilotSkill: 2,
      xp: 150,
      unlockedAbilityIds: ["marksman"],
      equippedAbilityIds: ["marksman"],
      statBonuses: { hull: 1, shields: 0, attack: 0, agility: 0 },
      evolutionChoiceIds: [],
    },
  ],
  pendingEvolution: false,
};

describe("migrateCampaignSave", () => {
  it("migrates v2 to v4 keeping every v2 field", () => {
    const save = migrateCampaignSave(V2_SAVE, "terran_hegemony")!;
    expect(save.version).toBe(4);
    const { version: _v, ...v2Fields } = V2_SAVE;
    expect(save).toMatchObject(v2Fields);
  });

  it("derives hero power unlocks from the missions already completed", () => {
    const save = migrateCampaignSave(V2_SAVE, "terran_hegemony")!;
    expect(save.heroPowerRanks).toEqual({
      orbital_strike: 1,
      shield_overcharge: 1,
    });
  });

  it("gives older saves empty v3 state", () => {
    const save = migrateCampaignSave(V2_SAVE, "terran_hegemony")!;
    expect(save).toMatchObject({
      storyFlags: {},
      branchChoices: {},
      researchPoints: 0,
      research: {},
      armory: { installed: {} },
      bonusObjectivesCompleted: [],
      campaignComplete: false,
    });
  });

  it("migrates a v1 save (no pilots) too", () => {
    const {
      campaignPilots: _p,
      pendingEvolution: _e,
      ...v1
    } = { ...V2_SAVE, version: 1 };
    const save = migrateCampaignSave(v1, "terran_hegemony")!;
    expect(save.campaignPilots).toEqual([]);
    expect(save.completedMissions).toEqual(V2_SAVE.completedMissions);
  });

  it("repairs malformed fields instead of dropping the save", () => {
    const save = migrateCampaignSave(
      {
        ...V2_SAVE,
        credits: "lots",
        storyFlags: { ok: true, bad: "yes" },
        research: { t: "C", u: "A" },
      },
      "terran_hegemony",
    )!;
    expect(save.credits).toBe(0);
    expect(save.storyFlags).toEqual({ ok: true });
    expect(save.research).toEqual({ u: "A" });
    expect(save.totalXp).toBe(400);
  });

  it("rejects input that is not a save object", () => {
    expect(migrateCampaignSave("nope", "terran_hegemony")).toBeNull();
    expect(migrateCampaignSave([1, 2], "terran_hegemony")).toBeNull();
  });
});

describe("applyMissionCompletion", () => {
  const fresh = CampaignSaveManager.createNew("void_corsairs");
  const record = {
    missionId: "cors_1_3",
    branchSlot: "slot_3",
    xp: 100,
    credits: 80,
    kills: 3,
    shipsLost: 0,
    unlocks: [],
    storyFlags: { cors_convoy_saved: true },
    bonuses: [{ objectiveId: "bonus", research: 2, credits: 50 }],
  };

  it("records flags, branch choice, research and bonus credits", () => {
    const { save, researchEarned } = applyMissionCompletion(fresh, record);
    expect(save.storyFlags).toEqual({ cors_convoy_saved: true });
    expect(save.branchChoices).toEqual({ slot_3: "cors_1_3" });
    expect(researchEarned).toBe(2);
    expect(save.researchPoints).toBe(2);
    expect(save.credits).toBe(130);
    expect(save.bonusObjectivesCompleted).toEqual(["cors_1_3:bonus"]);
  });

  it("never rewards the same bonus objective twice", () => {
    const once = applyMissionCompletion(fresh, record).save;
    const twice = applyMissionCompletion(once, record);
    expect(twice.researchEarned).toBe(0);
    expect(twice.save.researchPoints).toBe(2);
  });

  it("unlocks hero powers as missions complete", () => {
    let save = fresh;
    for (const id of ["a", "b", "c"]) {
      save = applyMissionCompletion(save, {
        ...record,
        missionId: id,
        bonuses: [],
      }).save;
    }
    expect(save.heroPowerRanks).toEqual({ cloak_dash: 1, scatter_mines: 1 });
  });

  it("marks the campaign complete after the finale", () => {
    const { save } = applyMissionCompletion(fresh, {
      ...record,
      isFinale: true,
    });
    expect(save.campaignComplete).toBe(true);
  });
});

describe("CampaignSaveManager persistence", () => {
  beforeEach(() => store.clear());

  it("round-trips flags, research, armory and credits", () => {
    const save = {
      ...CampaignSaveManager.createNew("ascendant_empire"),
      credits: 777,
      storyFlags: { asc_temple_held: true },
      research: { hull_doctrine: "B" as const },
      researchPoints: 4,
      armory: { installed: { capacitor_array: 150 } },
    };
    CampaignSaveManager.save(save);
    expect(CampaignSaveManager.load("ascendant_empire")).toMatchObject({
      credits: 777,
      storyFlags: { asc_temple_held: true },
      research: { hull_doctrine: "B" },
      researchPoints: 4,
      armory: { installed: { capacitor_array: 150 } },
    });
  });

  it("loads a stored v2 save as v3", () => {
    store.set(
      "shattered_stars_campaign_terran_hegemony",
      JSON.stringify(V2_SAVE),
    );
    const save = CampaignSaveManager.load("terran_hegemony")!;
    expect(save.version).toBe(4);
    expect(save.credits).toBe(325);
  });

  it("backs up unreadable JSON before treating the slot as empty", () => {
    store.set("shattered_stars_campaign_void_corsairs", "{{broken");
    expect(CampaignSaveManager.load("void_corsairs")).toBeNull();
    expect(
      store.get(
        "shattered_stars_campaign_void_corsairs" + CORRUPT_BACKUP_SUFFIX,
      ),
    ).toBe("{{broken");
  });

  it("autosaves when a victory is recorded", () => {
    const save = CampaignSaveManager.createNew("free_confederation");
    CampaignSaveManager.recordVictory(save, {
      missionId: "conf_1_1",
      xp: 10,
      credits: 5,
      kills: 0,
      shipsLost: 0,
      unlocks: [],
      storyFlags: { conf_started: true },
    });
    expect(CampaignSaveManager.load("free_confederation")?.storyFlags).toEqual({
      conf_started: true,
    });
  });
});
