/**
 * missionGraph — hub mission availability (SC2-style non-linear order):
 * act openers and finales are fixed, the middle missions of an act open
 * together; branch pairs lock their partner once one is flown.
 */

import { describe, expect, it } from "vitest";
import {
  availableMissions,
  branchSlotKey,
  defaultPrerequisites,
  hubMissionStatus,
  isFinaleMission,
} from "../../../src/campaign/hub/missionGraph";
import type {
  CampaignMission,
  FactionCampaign,
} from "../../../src/data/campaign/campaignTypes";

/** A bare mission in a slot. */
function m(
  id: string,
  missionNumber: number,
  extra: Partial<CampaignMission> = {},
): CampaignMission {
  return {
    id,
    act: missionNumber <= 5 ? 1 : missionNumber <= 10 ? 2 : 3,
    missionNumber,
    title: id,
    briefing: "",
    objectives: [],
    playerShips: [],
    maxSquadSize: 1,
    enemies: [],
    rewards: { xp: 0, credits: 0 },
    ...extra,
  };
}

const CAMPAIGN: FactionCampaign = {
  factionId: "terran_hegemony",
  name: "Test",
  description: "",
  protagonist: "",
  missions: [
    m("m1", 1),
    m("m2", 2),
    m("m3a", 3, { isBranch: true }),
    m("m3b", 3, { isBranch: true }),
    m("m4", 4),
    m("m5", 5),
    m("m6", 6),
    m("m7", 7),
    m("m8", 8),
    m("m9", 9),
    m("m10", 10),
    m("m11", 11, { prerequisites: [10] }),
  ],
};

const ids = (completed: string[]): string[] =>
  availableMissions(CAMPAIGN, {
    completedMissions: completed,
    storyFlags: {},
  }).map((x) => x.id);

describe("default prerequisites", () => {
  it("opens act I one step at a time, then a choice", () => {
    expect(defaultPrerequisites(1)).toEqual([]);
    expect(defaultPrerequisites(2)).toEqual([1]);
    expect(defaultPrerequisites(3)).toEqual([2]);
    expect(defaultPrerequisites(4)).toEqual([2]);
    expect(defaultPrerequisites(5)).toEqual([3, 4]);
  });

  it("opens a later act's middle missions together after its opener", () => {
    expect(defaultPrerequisites(6)).toEqual([5]);
    expect(defaultPrerequisites(7)).toEqual([6]);
    expect(defaultPrerequisites(9)).toEqual([6]);
    expect(defaultPrerequisites(10)).toEqual([7, 8, 9]);
  });
});

describe("hub availability", () => {
  it("starts with only the first mission", () => {
    expect(ids([])).toEqual(["m1"]);
  });

  it("offers at least two missions at once in the middle of an act", () => {
    expect(ids(["m1", "m2"])).toEqual(["m3a", "m3b", "m4"]);
    expect(ids(["m1", "m2", "m3a", "m4", "m5", "m6"])).toEqual([
      "m7",
      "m8",
      "m9",
    ]);
  });

  it("locks the other branch once one is flown", () => {
    const save = { completedMissions: ["m1", "m2", "m3a"], storyFlags: {} };
    expect(hubMissionStatus(CAMPAIGN.missions[3]!, CAMPAIGN, save)).toBe(
      "not_taken",
    );
    expect(ids(save.completedMissions)).toEqual(["m4"]);
  });

  it("holds the act finale until every middle slot is done", () => {
    expect(ids(["m1", "m2", "m3b"])).toEqual(["m4"]);
    expect(ids(["m1", "m2", "m3b", "m4"])).toEqual(["m5"]);
  });

  it("honours explicit prerequisites", () => {
    const done = ["m1", "m2", "m3a", "m4", "m5", "m6", "m7", "m8", "m9"];
    expect(ids(done)).toEqual(["m10"]);
    expect(ids([...done, "m10"])).toEqual(["m11"]);
  });

  it("knows the finale and the branch slot key", () => {
    expect(isFinaleMission(CAMPAIGN.missions[11]!, CAMPAIGN)).toBe(true);
    expect(isFinaleMission(CAMPAIGN.missions[0]!, CAMPAIGN)).toBe(false);
    expect(branchSlotKey(CAMPAIGN.missions[2]!)).toBe("slot_3");
    expect(branchSlotKey(CAMPAIGN.missions[0]!)).toBeUndefined();
  });
});
