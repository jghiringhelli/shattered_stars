/**
 * Coalition missions (story Acts IV-V, docs/lore/campaign_arc.md): eight
 * missions, each fully designed with real mechanics, explicit hub
 * prerequisites, boss fights naming creatures, lead-aware allies and flag
 * reads that resolve.
 */

import { describe, expect, it } from "vitest";
import { compileMission } from "../../../src/campaign/mission/compileMission";
import {
  MAX_ESCORT_TARGETS,
  isConstraintObjective,
} from "../../../src/arcade/objectives";
import type { CampaignMission } from "../../../src/data/campaign/campaignTypes";
import { CHRONICLE_FLAGS } from "../../../src/data/campaign/crossovers";
import { COALITION_INFO } from "../../../src/data/campaign/missions/coalition";
import { findCreature } from "../../../src/data/creatures/creatureCatalog";
import { getShipDefinition } from "../../../src/data/ShipDefinitions";
import {
  ACT_THREE_FINALE_XP,
  EXPECTED_PREREQUISITES,
  KNOWN_PORTRAITS,
  LEAD_FLAGS,
  MAX_DEBRIEF_CHARACTERS,
  MISSIONS,
  ORIGIN,
  WRITTEN,
  actionsOf,
  addedObjectives,
  beatsOf,
  persisted,
  readFlags,
  shipIdsOf,
} from "./coalitionFixtures";

describe("Coalition campaign", () => {
  it("has the eight Act IV-V missions in order", () => {
    expect(MISSIONS.map((m) => m.id)).toEqual([
      "coal_4_1",
      "coal_4_2",
      "coal_4_3",
      "coal_4_4",
      "coal_4_5",
      "coal_5_1",
      "coal_5_2",
      "coal_5_3",
    ]);
    expect(MISSIONS.map((m) => m.missionNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(MISSIONS.map((m) => m.act)).toEqual([4, 4, 4, 4, 4, 5, 5, 5]);
  });

  it("describes itself for the hub", () => {
    expect(COALITION_INFO.name).toBe("The Coalition");
    expect(COALITION_INFO.description.length).toBeGreaterThan(0);
    expect(COALITION_INFO.protagonist.length).toBeGreaterThan(0);
  });

  it.each(MISSIONS.map((m) => [m.id, m] as const))(
    "%s sits on the story timeline with a place and a squad",
    (_id, mission) => {
      const [from, to] = mission.act === 4 ? [201, 260] : [261, 300];
      expect(mission.day).toBeGreaterThanOrEqual(from);
      expect(mission.day).toBeLessThanOrEqual(to);
      expect(mission.location?.length ?? 0).toBeGreaterThan(0);
      expect(mission.maxSquadSize).toBeGreaterThanOrEqual(4);
      expect(mission.maxSquadSize).toBeLessThanOrEqual(6);
      expect(mission.playerShips.length).toBeGreaterThan(0);
      expect(mission.rewards.xp).toBeGreaterThan(ACT_THREE_FINALE_XP);
      expect(mission.rewards.credits).toBeGreaterThan(ACT_THREE_FINALE_XP - 1);
    },
  );

  it("keeps the days in story order", () => {
    const days = MISSIONS.map((m) => m.day ?? 0);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });

  it("states explicit hub prerequisites", () => {
    for (const mission of MISSIONS)
      expect(mission.prerequisites, mission.id).toEqual(
        EXPECTED_PREREQUISITES[mission.id],
      );
  });

  it.each(MISSIONS.map((m) => [m.id, m] as const))(
    "%s is fully designed",
    (_id, mission) => {
      expect(mission.style).toBeDefined();
      expect(mission.tagline?.length ?? 0).toBeGreaterThan(0);
      for (const id of shipIdsOf(mission))
        expect(getShipDefinition(id) ?? findCreature(id), id).toBeDefined();
      const plan = compileMission(mission, {}, ORIGIN);
      const goals = plan.objectives.filter(
        (o) => !o.optional && !isConstraintObjective(o),
      );
      expect(goals.length).toBeGreaterThan(0);
      expect(
        plan.objectives.some(
          (o) => o.optional && (o.reward?.research ?? 0) >= 1,
        ),
      ).toBe(true);
      expect(plan.script.length).toBeGreaterThanOrEqual(3);
      expect(actionsOf(plan.script).some((a) => a.do === "say")).toBe(true);
      for (const o of plan.objectives)
        if (o.type === "escort")
          expect(o.transports.count).toBeLessThanOrEqual(MAX_ESCORT_TARGETS);
    },
  );

  it.each(MISSIONS.map((m) => [m.id, m] as const))(
    "%s references resolve",
    (_id, mission) => {
      const plan = compileMission(mission, {}, ORIGIN);
      const objectiveIds = new Set(
        [...plan.objectives, ...addedObjectives(plan.script)].map((o) => o.id),
      );
      expect(objectiveIds.size).toBe(
        plan.objectives.length + addedObjectives(plan.script).length,
      );
      const hazardIds = new Set((mission.hazards ?? []).map((h) => h.id));
      const beats = beatsOf(mission);
      expect(new Set(beats.map((b) => b.id)).size).toBe(beats.length);
      for (const b of beats)
        if (b.when.on === "objective")
          expect(objectiveIds, b.when.objectiveId).toContain(
            b.when.objectiveId,
          );
      for (const a of actionsOf(beats)) {
        if (
          a.do === "revealObjective" ||
          a.do === "completeObjective" ||
          a.do === "failObjective"
        )
          expect(objectiveIds, a.objectiveId).toContain(a.objectiveId);
        if (a.do === "hazard")
          expect(hazardIds, a.hazardId).toContain(a.hazardId);
      }
    },
  );

  it("varies the mission styles across the campaign", () => {
    const styles = new Set(MISSIONS.map((m) => m.style));
    expect(styles.size).toBeGreaterThanOrEqual(6);
    for (const style of ["defense", "escort", "assassination", "boss", "race"])
      expect(styles.has(style as CampaignMission["style"]), style).toBe(true);
  });

  it("names Tide creatures in the boss missions", () => {
    const creaturesOf = (id: string): string[] =>
      shipIdsOf(MISSIONS.find((m) => m.id === id)!).filter(
        (shipId) => findCreature(shipId) !== undefined,
      );
    expect(creaturesOf("coal_4_5")).toContain("pruning_herald");
    expect(creaturesOf("coal_5_3")).toContain("warden_avatar");
    expect(creaturesOf("coal_5_2")).toContain("pruning_herald");
    for (const id of ["coal_4_1", "coal_4_2", "coal_5_1", "coal_5_3"])
      expect(creaturesOf(id), id).toContain("tidecell");
  });

  it("puts the Warden's avatar and the Herald on assassination objectives", () => {
    const bossTargets = (id: string): string[] =>
      compileMission(
        MISSIONS.find((m) => m.id === id)!,
        {},
        ORIGIN,
      ).objectives.flatMap((o) =>
        o.type === "assassinate" ? [o.targetShipId] : [],
      );
    expect(bossTargets("coal_4_5")).toEqual(["pruning_herald"]);
    expect(bossTargets("coal_5_3")).toEqual(["warden_avatar"]);
  });

  it("uses the allowed hazards and a void front in Heart of the Void", () => {
    const allowed = new Set([
      "ion_storm",
      "minefield",
      "asteroid_belt",
      "flare_wall",
    ]);
    for (const mission of MISSIONS)
      for (const hazard of mission.hazards ?? [])
        expect(allowed.has(hazard.kind), hazard.id).toBe(true);
    const lane = MISSIONS.find((m) => m.id === "coal_5_2")!;
    expect(lane.hazards?.some((h) => h.kind === "flare_wall")).toBe(true);
  });

  it("spawns only allies that stand down when their own faction leads", () => {
    for (const mission of MISSIONS) {
      const leadAllies = (mission.allies ?? []).filter((a) => a.unlessLead);
      const factions = leadAllies.map((a) => a.unlessLead);
      expect(new Set(factions).size, mission.id).toBe(factions.length);
    }
    const truce = MISSIONS.find((m) => m.id === "coal_4_1")!;
    expect((truce.allies ?? []).map((a) => [a.tag, a.unlessLead])).toEqual([
      ["ironfist", "terran_hegemony"],
      ["libre", "free_confederation"],
    ]);
  });

  it("only reads flags that exist", () => {
    for (const mission of MISSIONS)
      for (const flag of readFlags(mission))
        expect(
          CHRONICLE_FLAGS.has(flag) ||
            WRITTEN.has(flag) ||
            LEAD_FLAGS.has(flag),
          `${mission.id} reads ${flag}`,
        ).toBe(true);
  });

  it("never reads a flag it persists itself", () => {
    for (const mission of MISSIONS) {
      const written = new Set(persisted(mission));
      for (const flag of readFlags(mission))
        expect(written.has(flag), `${mission.id} ${flag}`).toBe(false);
    }
  });

  it("carries story consequences forward and reads Chronicle echoes", () => {
    const read = new Set(MISSIONS.flatMap(readFlags));
    expect([...WRITTEN].some((f) => read.has(f))).toBe(true);
    for (const flag of [
      "synth_gate_virus",
      "x3_shard_taken",
      "cors_gate_codes",
    ])
      expect(read.has(flag), flag).toBe(true);
    expect(WRITTEN.has("coal_vance_stopped")).toBe(true);
    expect(WRITTEN.has("coal_exodus_complete")).toBe(true);
  });

  it("briefs the Prime blame when the gate virus is set", () => {
    for (const id of ["coal_4_1", "coal_4_4"]) {
      const mission = MISSIONS.find((m) => m.id === id)!;
      const variant = (mission.variants ?? []).find(
        (v) => v.when.flag === "synth_gate_virus",
      );
      expect(variant?.briefing, id).toMatch(/Prime/);
    }
  });

  it.each(MISSIONS.map((m) => [m.id, m] as const))(
    "%s has a short debrief with known portraits",
    (_id, mission) => {
      expect((mission.debrief ?? []).length).toBeGreaterThanOrEqual(3);
      for (const line of mission.debrief ?? []) {
        expect(line.text.length).toBeLessThanOrEqual(MAX_DEBRIEF_CHARACTERS);
        expect(KNOWN_PORTRAITS.has(line.portraitKey), line.portraitKey).toBe(
          true,
        );
      }
    },
  );
});
