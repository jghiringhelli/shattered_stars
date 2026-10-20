/**
 * On-win beats in shipped mission data: the Brannoc ceasefire call plays
 * after the win (as the debrief's opening lines), not at a late kill, and
 * the win phase only holds dialogue and story flags.
 */

import { describe, expect, it } from "vitest";
import {
  COALITION_CAMPAIGN,
  FACTION_CAMPAIGNS,
} from "../../../src/data/CampaignData";
import type { CampaignMission } from "../../../src/data/campaign/campaignTypes";
import { compileMission } from "../../../src/campaign/mission/compileMission";
import { CampaignMissionRuntime } from "../../../src/arcade/systems/CampaignMissionRuntime";
import type { ScriptBeat } from "../../../src/campaign/scripting/scriptTypes";

const MISSIONS: readonly CampaignMission[] = [
  ...Object.values(FACTION_CAMPAIGNS),
  COALITION_CAMPAIGN,
].flatMap((campaign) => campaign.missions);
const ORIGIN = { x: 3000, y: 3000 };
const WORLD = 6000;

const beatsOf = (mission: CampaignMission): readonly ScriptBeat[] => [
  ...(mission.script ?? []),
  ...(mission.variants ?? []).flatMap((v) => v.script ?? []),
];

const mission = (id: string): CampaignMission => {
  const found = MISSIONS.find((m) => m.id === id);
  if (!found) throw new Error(`no mission ${id}`);
  return found;
};

describe("on-win beats in mission data", () => {
  it("hold only dialogue and story flags", () => {
    for (const m of MISSIONS)
      for (const b of beatsOf(m).filter((x) => x.when.on === "victory"))
        for (const a of b.actions)
          expect([m.id, a.do === "say" || a.do === "setFlag"]).toEqual([
            m.id,
            true,
          ]);
  });

  it("play Chen's ceasefire call at Brannoc after the win, not at a kill count", () => {
    const brannoc = mission("conf_3_4");
    const chenBeats = beatsOf(brannoc).filter((b) =>
      b.actions.some(
        (a) => a.do === "say" && /calling a ceasefire/.test(a.text),
      ),
    );
    expect(chenBeats).toHaveLength(1);
    expect(chenBeats[0]!.when.on).toBe("victory");
    expect(
      beatsOf(brannoc).some(
        (b) => b.when.on === "destroyed" && (b.when.count ?? 1) > 1,
      ),
    ).toBe(false);
  });

  it("reach the debrief hand-off when the Brannoc mission is won", () => {
    const brannoc = mission("conf_3_4");
    const runtime = new CampaignMissionRuntime(
      compileMission(brannoc, {}, ORIGIN),
      {},
      WORLD,
    );
    expect(
      runtime
        .stepScript([])
        .sceneActions.some((a) => a.do === "say" && /ceasefire/.test(a.text)),
    ).toBe(false);
    const texts = runtime.finalizeVictory().victoryLines.map((l) => l.text);
    expect(texts[0]).toMatch(/calling a ceasefire/);
    expect(texts[1]).toMatch(/Hold fire/);
  });

  it("add the Phoenix reply only when the ceasefire is already canon", () => {
    const brannoc = mission("conf_3_4");
    const lines = (flags: Record<string, boolean>): string[] =>
      new CampaignMissionRuntime(
        compileMission(brannoc, flags, ORIGIN),
        flags,
        WORLD,
      )
        .finalizeVictory()
        .victoryLines.map((l) => l.text);
    expect(lines({}).some((t) => /called it from his own gate/.test(t))).toBe(
      false,
    );
    expect(
      lines({ x14_ceasefire_called: true }).some((t) =>
        /called it from his own gate/.test(t),
      ),
    ).toBe(true);
  });
});
