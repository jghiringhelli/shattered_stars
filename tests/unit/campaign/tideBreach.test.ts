/**
 * Spec: every faction's Act III finale ends on the Breach — the Void Tide's
 * Tidecells arrive when its last goal completes (campaign_arc.md) — no other
 * mission does; and an assassination objective can name a creature, which
 * spawns as a boss-tagged enemy request the battle scene turns into a
 * creature ship.
 */

import { describe, it, expect } from "vitest";
import {
  BREACH_CREATURE_COUNT,
  BREACH_CREATURE_ID,
  isActThreeFinale,
} from "../../../src/campaign/mission/tideBreach";
import { compileMission } from "../../../src/campaign/mission/compileMission";
import { objectiveSpawnRequest } from "../../../src/campaign/battle/missionSpawns";
import { objectiveSpawns } from "../../../src/arcade/objectives";
import { FACTION_CAMPAIGNS } from "../../../src/data/CampaignData";
import { findCreature } from "../../../src/data/creatures/creatureCatalog";

const ORIGIN = { x: 3000, y: 3000 };
const MISSIONS = Object.values(FACTION_CAMPAIGNS).flatMap((c) => c.missions);

describe("the Breach beat of the Act III finales", () => {
  const finales = MISSIONS.filter(isActThreeFinale);

  it("belongs_to_exactly_the_five_faction_finales", () => {
    expect(finales).toHaveLength(5);
  });

  it("sends_tidecells_ahead_when_the_last_goal_completes", () => {
    for (const mission of finales) {
      const plan = compileMission(mission, {}, ORIGIN);
      const breach = plan.script.find((b) => b.id.endsWith("_tide_breach"));
      expect(breach, mission.id).toBeDefined();
      const spawn = breach!.actions.find((a) => a.do === "spawn");
      expect(spawn).toMatchObject({
        group: {
          shipId: BREACH_CREATURE_ID,
          count: BREACH_CREATURE_COUNT,
          at: "ahead",
        },
      });
      expect(breach!.when).toMatchObject({
        on: "objective",
        status: "completed",
      });
    }
  });

  it("is_absent_from_every_other_mission", () => {
    const others = MISSIONS.filter((m) => !isActThreeFinale(m));
    for (const mission of others)
      expect(
        compileMission(mission, {}, ORIGIN).script.some((b) =>
          b.id.endsWith("_tide_breach"),
        ),
        mission.id,
      ).toBe(false);
  });
});

describe("a creature as an assassination target", () => {
  it("spawns_the_warden_avatar_as_a_boss_tagged_enemy_request", () => {
    const [spawn] = objectiveSpawns({
      id: "avatar",
      type: "assassinate",
      description: "Destroy the Warden's avatar",
      targetShipId: "warden_avatar",
      at: { x: 0, y: -900 },
      isBoss: true,
    });
    expect(findCreature(spawn!.shipId)).toBeDefined();
    const request = objectiveSpawnRequest(spawn!, "terran_hegemony");
    expect(request).toMatchObject({
      definitionId: "warden_avatar",
      owner: "ai",
      isBoss: true,
    });
    expect(request.tags).toContain("boss");
  });
});
