import { describe, expect, it } from "vitest";
import {
  COALITION_CAMPAIGN,
  FACTION_CAMPAIGNS,
} from "../../../src/data/CampaignData";

const ALL_MISSIONS = [
  ...Object.values(FACTION_CAMPAIGNS).flatMap((c) => c.missions),
  ...COALITION_CAMPAIGN.missions,
];

/** The knob's sane range: a group is never trivial nor a wall. */
const MIN_HULL_SCALE = 0.4;
const MAX_HULL_SCALE = 1.5;

describe("per-mission enemy difficulty knob (MissionEnemy.hullScale)", () => {
  it("is absent or inside its sane range on every enemy group", () => {
    for (const mission of ALL_MISSIONS)
      for (const enemy of mission.enemies) {
        if (enemy.hullScale === undefined) continue;
        expect(enemy.hullScale, mission.id).toBeGreaterThanOrEqual(
          MIN_HULL_SCALE,
        );
        expect(enemy.hullScale, mission.id).toBeLessThanOrEqual(MAX_HULL_SCALE);
      }
  });

  it("leaves every mission with at least one enemy group or a scripted spawn", () => {
    for (const mission of ALL_MISSIONS) {
      const scripted = JSON.stringify(mission.script ?? []).includes('"spawn"');
      expect(
        mission.enemies.length > 0 || scripted || mission.missionNumber === 1,
        mission.id,
      ).toBe(true);
    }
  });

  it("fields the Coalition's finale against a real force, not two ships (round 4)", () => {
    const finale = COALITION_CAMPAIGN.missions.find((m) => m.id === "coal_4_5");
    const hulls = finale?.enemies.reduce((sum, e) => sum + e.count, 0) ?? 0;
    expect(hulls).toBeGreaterThanOrEqual(8);
  });
});
