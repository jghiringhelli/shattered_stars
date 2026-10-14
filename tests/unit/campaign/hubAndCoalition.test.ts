/**
 * Hub act locks (Rule of N in the mission graph), the Coalition launch rules
 * (lead hero squad, lead-gated allies, Coalition save) and the epilogue patch.
 */

import { describe, expect, it } from "vitest";
import { emptyChronicle } from "../../../src/campaign/chronicle/chronicleRules";
import type { ChronicleData } from "../../../src/campaign/chronicle/chronicleTypes";
import {
  applyEpiloguePatch,
  endingEpilogueLines,
  epilogueLines,
} from "../../../src/campaign/hub/campaignCompletion";
import { hubViewOf } from "../../../src/campaign/hub/hubProgress";
import {
  availableMissions,
  hubMissionStatus,
} from "../../../src/campaign/hub/missionGraph";
import {
  leadFlags,
  missionForLead,
} from "../../../src/campaign/coalition/coalitionLaunch";
import { compileMission } from "../../../src/campaign/mission/compileMission";
import {
  COALITION_CAMPAIGN,
  FACTION_CAMPAIGNS,
} from "../../../src/data/CampaignData";
import { CampaignSaveManager } from "../../../src/systems/CampaignSaveManager";

const HEG = FACTION_CAMPAIGNS.terran_hegemony;
const ACT_ONE = ["heg_1_1", "heg_1_2", "heg_1_3", "heg_1_4", "heg_1_5"];

/** A Hegemony save with the given missions done. */
const savedAfter = (completed: string[]) => ({
  ...CampaignSaveManager.createNew("terran_hegemony"),
  completedMissions: completed,
});

/** A Chronicle where only the Hegemony finished Act I. */
const hegOnly: ChronicleData = {
  ...emptyChronicle(),
  actsComplete: { terran_hegemony: [1] },
};

describe("hub act locks", () => {
  it("offers nothing in a locked act and says why", () => {
    const view = hubViewOf(HEG, savedAfter(ACT_ONE), hegOnly);
    expect(view.lockedActs).toEqual([2, 3]);
    expect(availableMissions(HEG, view)).toEqual([]);
    const supply = HEG.missions.find((m) => m.id === "heg_2_1")!;
    expect(hubMissionStatus(supply, HEG, view)).toBe("locked");
    expect(view.statuses[1]?.reason).toContain("1 more faction");
  });

  it("opens the act once a second faction has finished Act I", () => {
    const both: ChronicleData = {
      ...hegOnly,
      actsComplete: { terran_hegemony: [1], free_confederation: [1] },
    };
    const view = hubViewOf(HEG, savedAfter(ACT_ONE), both);
    expect(availableMissions(HEG, view).map((m) => m.id)).toEqual(["heg_2_1"]);
  });

  it("never locks an act that already holds progress", () => {
    const view = hubViewOf(HEG, savedAfter([...ACT_ONE, "heg_2_1"]), hegOnly);
    expect(view.lockedActs).toEqual([3]);
  });

  it("keeps completed missions completed inside a locked act", () => {
    const view = hubViewOf(HEG, savedAfter(["heg_2_1"]), emptyChronicle());
    const supply = HEG.missions.find((m) => m.id === "heg_2_1")!;
    expect(hubMissionStatus(supply, HEG, view)).toBe("completed");
  });
});

describe("Coalition launch", () => {
  const opener = COALITION_CAMPAIGN.missions.find((m) => m.id === "coal_4_1")!;

  it("flies the lead hero's faction roster", () => {
    const mission = missionForLead(opener, "void_corsairs");
    expect(mission.playerShips.length).toBeGreaterThan(0);
    expect(mission.playerShips.every((s) => s.startsWith("corsair_"))).toBe(true);
    expect(mission.id).toBe(opener.id);
  });

  it("does not deploy the ally squad of the hero that leads", () => {
    const squads = (lead: "terran_hegemony" | "free_confederation") =>
      compileMission(missionForLead(opener, lead), leadFlags(lead), { x: 0, y: 0 }, lead).allies;
    const asHeg = squads("terran_hegemony");
    const asConf = squads("free_confederation");
    expect(asHeg.length).toBeGreaterThan(0);
    expect(asHeg.some((a) => a.unlessLead === "terran_hegemony")).toBe(false);
    expect(asConf.some((a) => a.unlessLead === "free_confederation")).toBe(false);
    expect(asHeg.map((a) => a.name)).not.toEqual(asConf.map((a) => a.name));
  });

  it("names the lead as a mission-local flag", () => {
    expect(leadFlags("ascendant_empire")).toEqual({ lead_ascendant_empire: true });
  });
});

describe("epilogues", () => {
  const base = [
    { speaker: "A", portraitKey: "p", text: "Vance is in a cell." },
    { speaker: "B", portraitKey: "p", text: "Closing line." },
  ];

  it("swaps text and inserts new lines before the closing line", () => {
    const patched = applyEpiloguePatch(base, {
      swaps: [["a cell", "chains"]],
      add: [{ speaker: "C", portraitKey: "p", text: "New." }],
    });
    expect(patched.map((l) => l.text)).toEqual([
      "Vance is in chains.",
      "New.",
      "Closing line.",
    ]);
  });

  it("leaves an epilogue alone without a patch", () => {
    expect(applyEpiloguePatch(base, undefined)).toEqual(base);
  });

  it("shows a flag-conditioned faction line only when the flag holds", () => {
    const without = epilogueLines("free_confederation", {});
    const withFlag = epilogueLines("free_confederation", { x14_ceasefire_called: true });
    expect(withFlag.length).toBeGreaterThan(without.length);
  });

  it("has an epilogue for every ending", () => {
    for (const ending of ["answer", "sever", "seal", "quiet"] as const)
      expect(endingEpilogueLines(ending, {}).length).toBeGreaterThan(0);
  });
});
