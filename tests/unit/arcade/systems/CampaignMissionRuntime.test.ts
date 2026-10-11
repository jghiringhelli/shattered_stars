/**
 * CampaignMissionRuntime — the per-battle coordinator of a compiled mission:
 * objective entities to spawn, objective/script/hazard steps, scripted
 * reveals, tracker rows and the victory hand-off (bonus objectives + story
 * flags). No Phaser.
 */

import { describe, expect, it } from "vitest";
import {
  CampaignMissionRuntime,
  type RuntimeShip,
} from "../../../../src/arcade/systems/CampaignMissionRuntime";
import type { MissionPlan } from "../../../../src/campaign/mission/compileMission";

const WORLD = 6000;

function plan(overrides: Partial<MissionPlan> = {}): MissionPlan {
  return {
    missionId: "m",
    title: "M",
    briefing: "",
    objectives: [
      { id: "kill", type: "eliminate", description: "Kill two", count: 2 },
      {
        id: "bonus",
        type: "protect",
        description: "No losses",
        tag: "squad",
        optional: true,
        reward: { research: 2, credits: 30 },
      },
      {
        id: "convoy",
        type: "escort",
        description: "Escort",
        path: [
          { x: 0, y: 0 },
          { x: 500, y: 0 },
        ],
        speed: 50,
        transports: { shipId: "terran_sentinel", count: 1 },
        maxLosses: 0,
        hidden: true,
      },
    ],
    script: [],
    hazards: [],
    enemies: [],
    allies: [],
    ...overrides,
  };
}

const flagship: RuntimeShip = {
  id: "flag",
  side: "player",
  x: 0,
  y: 0,
  hull: 10,
  maxHull: 10,
  weight: 1,
  tags: ["squad"],
  stressed: false,
};

describe("CampaignMissionRuntime", () => {
  it("spawns entities of visible objectives only at start", () => {
    expect(
      new CampaignMissionRuntime(plan(), {}, WORLD).initialSpawns(),
    ).toEqual([]);
  });

  it("reveals a hidden objective by script and spawns its entities", () => {
    const runtime = new CampaignMissionRuntime(
      plan({
        script: [
          {
            id: "r",
            when: { on: "start" },
            actions: [{ do: "revealObjective", objectiveId: "convoy" }],
          },
        ],
      }),
      {},
      WORLD,
    );
    const { newSpawns } = runtime.stepScript([flagship]);
    expect(newSpawns.map((s) => s.id)).toEqual(["convoy_t0"]);
    expect(runtime.trackerRows().map((r) => r.id)).toContain("convoy");
  });

  it("hands dialogue/spawn/banner/music actions to the scene, keeps the rest", () => {
    const runtime = new CampaignMissionRuntime(
      plan({
        script: [
          {
            id: "s",
            when: { on: "start" },
            actions: [
              { do: "say", speaker: "A", portraitKey: "p", text: "hi" },
              { do: "setFlag", flag: "x" },
              { do: "completeObjective", objectiveId: "kill" },
            ],
          },
        ],
      }),
      {},
      WORLD,
    );
    const { sceneActions } = runtime.stepScript([flagship]);
    expect(sceneActions.map((a) => a.do)).toEqual(["say"]);
    expect(runtime.objectiveStatus("kill")).toBe("completed");
  });

  it("counts recorded destructions and reports victory", () => {
    const runtime = new CampaignMissionRuntime(
      plan({ objectives: plan().objectives.slice(0, 2) }),
      {},
      WORLD,
    );
    runtime.recordDestroyed({
      shipId: "e1",
      side: "enemy",
      tags: [],
      x: 0,
      y: 0,
    });
    expect(runtime.stepObjectives([flagship], "flag")).toBe("ongoing");
    runtime.recordDestroyed({
      shipId: "e2",
      side: "enemy",
      tags: [],
      x: 0,
      y: 0,
    });
    expect(runtime.stepObjectives([flagship], "flag")).toBe("victory");
  });

  it("on victory completes holding constraints, lists rewarded bonuses and story flags", () => {
    const runtime = new CampaignMissionRuntime(
      plan({
        objectives: plan().objectives.slice(0, 2),
        script: [
          {
            id: "f",
            when: {
              on: "objective",
              objectiveId: "bonus",
              status: "completed",
            },
            actions: [{ do: "setFlag", flag: "clean_run", persist: true }],
          },
        ],
      }),
      { old_flag: true },
      WORLD,
    );
    const result = runtime.finalizeVictory();
    expect(result.bonuses.map((b) => b.id)).toEqual(["bonus"]);
    expect(result.storyFlags).toEqual({ clean_run: true });
  });

  it("advances its clock and drives hazards", () => {
    const runtime = new CampaignMissionRuntime(
      plan({
        hazards: [
          {
            id: "storm",
            kind: "ion_storm",
            at: { x: 0, y: 0 },
            radius: 100,
            shieldDrainPerSecond: 10,
          },
        ],
      }),
      {},
      WORLD,
    );
    runtime.tick(1000);
    expect(runtime.elapsedMs).toBe(1000);
    expect(runtime.stepHazards([flagship], 1000)).toEqual([
      { shipId: "flag", hullDamage: 0, shieldDrain: 10, stress: 0 },
    ]);
  });

  it("switches hazards from the script", () => {
    const runtime = new CampaignMissionRuntime(
      plan({
        hazards: [
          {
            id: "storm",
            kind: "ion_storm",
            at: { x: 0, y: 0 },
            radius: 100,
            shieldDrainPerSecond: 10,
          },
        ],
        script: [
          {
            id: "h",
            when: { on: "start" },
            actions: [{ do: "hazard", hazardId: "storm", active: false }],
          },
        ],
      }),
      {},
      WORLD,
    );
    runtime.stepScript([flagship]);
    expect(runtime.stepHazards([flagship], 1000)).toEqual([]);
  });
});
