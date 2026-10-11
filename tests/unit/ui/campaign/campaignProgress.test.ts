import { describe, expect, it } from "vitest";
import {
  FACTION_CAMPAIGNS,
  type CampaignMission,
} from "../../../../src/data/CampaignData";
import type {
  CampaignPilotState,
  CampaignSaveData,
} from "../../../../src/systems/CampaignSaveManager";
import { CampaignSaveManager } from "../../../../src/systems/CampaignSaveManager";
import { XP_THRESHOLDS } from "../../../../src/systems/CampaignPilotManager";
import {
  currentActGroups,
  missionStatus,
  xpProgress,
} from "../../../../src/ui/campaign/campaignProgress";
import {
  needsEvolutionChoice,
  statsPanelHeight,
  statsPanelTop,
  STATS_LAYOUT,
} from "../../../../src/ui/campaign/debriefTypes";

const HEGEMONY = FACTION_CAMPAIGNS.terran_hegemony;

function mission(missionNumber: number): CampaignMission {
  const found = HEGEMONY.missions.find(
    (m) => m.missionNumber === missionNumber,
  );
  if (!found) throw new Error(`no hegemony mission ${missionNumber}`);
  return found;
}

function pilot(overrides: Partial<CampaignPilotState>): CampaignPilotState {
  return {
    pilotId: "p1",
    currentShipId: "terran_viper",
    pilotSkill: 1,
    xp: 0,
    unlockedAbilityIds: [],
    equippedAbilityIds: [],
    statBonuses: { hull: 0, shields: 0, attack: 0, agility: 0 },
    evolutionChoiceIds: [],
    ...overrides,
  };
}

function saveWith(pilots: CampaignPilotState[]): CampaignSaveData {
  return CampaignSaveManager.createNew("terran_hegemony", pilots);
}

describe("missionStatus", () => {
  it("marks completed missions as completed even when behind the cursor", () => {
    expect(missionStatus(mission(1), 3, [mission(1).id])).toBe("completed");
  });

  it("marks skipped earlier missions as not_taken", () => {
    expect(missionStatus(mission(1), 3, [])).toBe("not_taken");
  });

  it("marks the current mission as available", () => {
    expect(missionStatus(mission(3), 3, [])).toBe("available");
  });

  it("marks future missions as locked", () => {
    expect(missionStatus(mission(4), 3, [])).toBe("locked");
  });
});

describe("currentActGroups", () => {
  it("returns only the current act's missions in mission-number order", () => {
    const groups = currentActGroups(HEGEMONY, 1);
    const numbers = groups.map((g) => g[0]!.missionNumber);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(groups.flat().every((m) => m.act === 1)).toBe(true);
  });

  it("groups branch missions sharing a number into one pair", () => {
    const pairs = currentActGroups(HEGEMONY, 1).filter((g) => g.length > 1);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]![0]!.missionNumber).toBe(pairs[0]![1]!.missionNumber);
  });

  it("falls back to act 1 when the current mission is unknown", () => {
    const groups = currentActGroups(HEGEMONY, 999);
    expect(groups.flat().every((m) => m.act === 1)).toBe(true);
  });
});

describe("xpProgress", () => {
  it("measures fractions within the pilot's current skill band", () => {
    const start = XP_THRESHOLDS[2]!;
    const end = XP_THRESHOLDS[3]!;
    const mid = start + (end - start) / 2;
    const result = xpProgress(start, pilot({ pilotSkill: 2, xp: mid }));
    expect(result.preRatio).toBe(0);
    expect(result.postRatio).toBeCloseTo(0.5);
  });

  it("clamps fractions above the band to 1", () => {
    const result = xpProgress(0, pilot({ pilotSkill: 2, xp: 10_000 }));
    expect(result.postRatio).toBe(1);
  });

  it("reports a full bar at max skill", () => {
    const result = xpProgress(5_000, pilot({ pilotSkill: 6, xp: 5_100 }));
    expect(result.postRatio).toBe(1);
  });
});

describe("needsEvolutionChoice", () => {
  const pivot = mission(5);
  const choice = pivot.evolutionChoice!;

  it("is false for missions without an evolution choice", () => {
    expect(needsEvolutionChoice(mission(1), saveWith([pilot({})]))).toBe(false);
  });

  it("is true for a pivot mission no pilot has chosen yet", () => {
    expect(needsEvolutionChoice(pivot, saveWith([pilot({})]))).toBe(true);
  });

  it("is false once a pilot holds either option", () => {
    const chosen = pilot({ evolutionChoiceIds: [choice.optionB.id] });
    expect(needsEvolutionChoice(pivot, saveWith([chosen]))).toBe(false);
  });
});

describe("stats panel layout", () => {
  it("never exceeds the content area", () => {
    const height = statsPanelHeight(4, 50);
    expect(height).toBe(STATS_LAYOUT.areaBottom - STATS_LAYOUT.areaTop);
    expect(statsPanelTop(height)).toBe(STATS_LAYOUT.areaTop);
  });

  it("centres the panels vertically in the content area", () => {
    const height = statsPanelHeight(4, 3);
    const top = statsPanelTop(height);
    const above = top - STATS_LAYOUT.areaTop;
    const below = STATS_LAYOUT.areaBottom - (top + height);
    expect(Math.abs(above - below)).toBeLessThanOrEqual(1);
  });
});
