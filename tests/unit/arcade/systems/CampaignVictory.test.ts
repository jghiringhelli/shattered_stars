/**
 * CampaignVictory — what a won mission adds to the playthrough: base rewards
 * (credits scaled by research), bonus objective awards (research + credits,
 * research bonus per objective), legacy bonus XP, story flags (scripted +
 * mission victory flags), branch slot and finale.
 */

import { describe, expect, it } from "vitest";
import { missionVictoryRecord } from "../../../../src/arcade/systems/CampaignVictory";
import { NEUTRAL_BONUSES } from "../../../../src/campaign/armory/bonusTypes";
import { CampaignSaveManager } from "../../../../src/systems/CampaignSaveManager";
import type {
  CampaignMission,
  FactionCampaign,
} from "../../../../src/data/campaign/campaignTypes";

const MISSION: CampaignMission = {
  id: "m3",
  act: 1,
  missionNumber: 3,
  title: "T",
  briefing: "",
  objectives: [],
  playerShips: ["terran_viper"],
  maxSquadSize: 1,
  enemies: [],
  rewards: { xp: 100, credits: 200, unlocks: ["terran_raptor"] },
  isBranch: true,
  victoryFlags: { m3_done: true },
};
const FINALE: CampaignMission = {
  ...MISSION,
  id: "m15",
  missionNumber: 15,
  isBranch: false,
};
const CAMPAIGN: FactionCampaign = {
  factionId: "terran_hegemony",
  name: "",
  description: "",
  protagonist: "",
  missions: [MISSION, FINALE],
};
const save = CampaignSaveManager.createNew("terran_hegemony");

function record(
  overrides: Partial<Parameters<typeof missionVictoryRecord>[0]> = {},
) {
  return missionVictoryRecord({
    mission: MISSION,
    campaign: CAMPAIGN,
    save,
    bonuses: [
      {
        id: "b",
        type: "protect",
        description: "",
        tag: "squad",
        optional: true,
        reward: { research: 2, credits: 40 },
      },
    ],
    storyFlags: { scripted: true },
    kills: 4,
    shipsLost: 1,
    bonusesActive: NEUTRAL_BONUSES,
    ...overrides,
  });
}

describe("missionVictoryRecord", () => {
  it("passes base rewards, kills and unlocks through", () => {
    expect(record().record).toMatchObject({
      missionId: "m3",
      xp: 150,
      credits: 200,
      kills: 4,
      shipsLost: 1,
      unlocks: ["terran_raptor"],
    });
  });

  it("awards each bonus objective's research and credits", () => {
    expect(record().record.bonuses).toEqual([
      { objectiveId: "b", research: 2, credits: 40 },
    ]);
  });

  it("adds Tactical Analysis research per bonus and Salvage Protocols credits", () => {
    const r = record({
      bonusesActive: {
        ...NEUTRAL_BONUSES,
        researchPerBonus: 1,
        creditMultiplier: 1.25,
      },
    });
    expect(r.record.bonuses?.[0]?.research).toBe(3);
    expect(r.record.credits).toBe(250);
  });

  it("merges scripted story flags with the mission's victory flags", () => {
    expect(record().record.storyFlags).toEqual({
      scripted: true,
      m3_done: true,
    });
  });

  it("records the branch slot of a branch mission", () => {
    expect(record().record.branchSlot).toBe("slot_3");
  });

  it("flags the finale", () => {
    expect(record().record.isFinale).toBeFalsy();
    expect(record({ mission: FINALE }).record.isFinale).toBe(true);
  });
});
