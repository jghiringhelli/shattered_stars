/**
 * compileMission — turns an authored campaign mission (offsets from the
 * battlefield centre, legacy objectives, story-flag variants and allies)
 * into a runnable plan in world coordinates.
 */

import { describe, expect, it } from "vitest";
import { compileMission } from "../../../src/campaign/mission/compileMission";
import type { CampaignMission } from "../../../src/data/campaign/campaignTypes";

const ORIGIN = { x: 3000, y: 3000 };

const BASE: CampaignMission = {
  id: "test_1",
  act: 2,
  missionNumber: 6,
  title: "Test",
  briefing: "Brief.",
  objectives: [
    { id: "kill", type: "eliminate", description: "Destroy", target: "Thing" },
  ],
  playerShips: ["terran_viper"],
  maxSquadSize: 1,
  enemies: [
    { shipId: "corsair_blade", count: 3, faction: "void_corsairs" },
    {
      shipId: "corsair_marauder",
      count: 2,
      faction: "void_corsairs",
      spawnDelay: 30_000,
    },
  ],
  rewards: { xp: 1, credits: 1 },
};

describe("legacy objective normalisation", () => {
  it("an eliminate with no count needs every mission enemy", () => {
    const [kill] = compileMission(BASE, {}, ORIGIN).objectives;
    expect(kill).toMatchObject({ type: "eliminate", count: 5 });
  });

  it("an eliminate naming a boss mission targets the boss", () => {
    const boss = {
      ...BASE,
      enemies: [
        ...BASE.enemies,
        {
          shipId: "synth_nexus",
          count: 1,
          faction: "synthetic_collective" as const,
          isBoss: true,
        },
      ],
    };
    const [kill] = compileMission(boss, {}, ORIGIN).objectives;
    expect(kill).toMatchObject({ type: "eliminate", count: 1, tag: "boss" });
  });

  it("gives a legacy escort a real convoy path and transports", () => {
    const escort = {
      ...BASE,
      objectives: [
        { id: "e", type: "escort" as const, description: "Protect the convoy" },
      ],
    };
    const [def] = compileMission(escort, {}, ORIGIN).objectives;
    expect(def?.type).toBe("escort");
    if (def?.type !== "escort") return;
    expect(def.path.length).toBeGreaterThanOrEqual(2);
    expect(def.transports.count).toBeGreaterThan(0);
  });

  it("gives a legacy capture a zone and a hold time", () => {
    const capture = {
      ...BASE,
      objectives: [
        { id: "c", type: "capture" as const, description: "Secure" },
      ],
    };
    expect(compileMission(capture, {}, ORIGIN).objectives[0]).toMatchObject({
      type: "capture",
      radius: expect.any(Number),
      holdSeconds: expect.any(Number),
    });
  });

  it("gives a timeless legacy survive a default duration", () => {
    const survive = {
      ...BASE,
      objectives: [{ id: "s", type: "survive" as const, description: "Live" }],
    };
    expect(
      compileMission(survive, {}, ORIGIN).objectives[0]?.timeLimit,
    ).toBeGreaterThan(0);
  });
});

describe("authored geometry", () => {
  it("resolves objective, script and hazard offsets against the origin", () => {
    const mission: CampaignMission = {
      ...BASE,
      objectives: [
        {
          id: "z",
          type: "capture",
          description: "Hold",
          at: { x: 100, y: -200 },
          radius: 200,
          holdSeconds: 10,
        },
      ],
      script: [
        {
          id: "a",
          when: { on: "area", at: { x: 0, y: -500 }, radius: 100 },
          actions: [],
        },
      ],
      hazards: [
        {
          id: "h",
          kind: "ion_storm",
          at: { x: -300, y: 0 },
          radius: 200,
          shieldDrainPerSecond: 1,
        },
      ],
    };
    const plan = compileMission(mission, {}, ORIGIN);
    expect(plan.objectives[0]).toMatchObject({ at: { x: 3100, y: 2800 } });
    expect(plan.script[0]?.when).toMatchObject({ at: { x: 3000, y: 2500 } });
    expect(plan.hazards[0]).toMatchObject({ at: { x: 2700, y: 3000 } });
  });
});

describe("story consequences", () => {
  const withAlly: CampaignMission = {
    ...BASE,
    allies: [
      {
        shipId: "terran_viper",
        count: 2,
        tag: "lance",
        name: "Lance",
        unlessFlag: "lance_lost",
      },
    ],
    variants: [
      {
        when: { flag: "convoy_saved" },
        title: "Test (Resupplied)",
        addAllies: [
          { shipId: "terran_bastion", count: 1, tag: "relief", name: "Relief" },
        ],
      },
    ],
  };

  it("deploys an allied squadron that has not been lost", () => {
    expect(
      compileMission(withAlly, {}, ORIGIN).allies.map((a) => a.tag),
    ).toEqual(["lance"]);
  });

  it("leaves a lost squadron out for good", () => {
    expect(
      compileMission(withAlly, { lance_lost: true }, ORIGIN).allies,
    ).toEqual([]);
  });

  it("applies a variant unlocked by an earlier choice", () => {
    const plan = compileMission(withAlly, { convoy_saved: true }, ORIGIN);
    expect(plan.title).toBe("Test (Resupplied)");
    expect(plan.allies.map((a) => a.tag)).toEqual(["lance", "relief"]);
  });
});
