/**
 * Campaign content integrity — every mission of every faction is playable
 * with real mechanics: ships exist, objectives compile with a real goal and
 * a research-granting bonus, scripts brief and react, references resolve,
 * each campaign spans the SC2-style mission variety and carries at least one
 * story consequence into a later mission.
 */

import { describe, expect, it } from "vitest";
import { FACTION_CAMPAIGNS } from "../../../src/data/CampaignData";
import type {
  CampaignMission,
  FactionCampaign,
} from "../../../src/data/campaign/campaignTypes";
import { findCreature } from "../../../src/data/creatures/creatureCatalog";
import { getShipDefinition } from "../../../src/data/ShipDefinitions";
import { compileMission } from "../../../src/campaign/mission/compileMission";
import {
  MAX_ESCORT_TARGETS,
  isConstraintObjective,
  objectiveSpawns,
  type ObjectiveDefinition,
} from "../../../src/arcade/objectives";
import type {
  ScriptAction,
  ScriptBeat,
} from "../../../src/campaign/scripting/scriptTypes";

const ORIGIN = { x: 3000, y: 3000 };
const CAMPAIGNS = Object.values(FACTION_CAMPAIGNS);
/** Mission archetypes each campaign must field at least once. */
const REQUIRED_STYLES: readonly (readonly string[])[] = [
  ["escort"],
  ["defense"],
  ["heist", "salvage"],
  ["assassination"],
  ["stealth"],
  ["hazard"],
  ["race"],
  ["boss"],
];

const actionsOf = (beats: readonly ScriptBeat[]): ScriptAction[] =>
  beats.flatMap((b) => b.actions);
const addedObjectives = (beats: readonly ScriptBeat[]): ObjectiveDefinition[] =>
  actionsOf(beats).flatMap((a) =>
    a.do === "addObjective" ? [a.objective] : [],
  );

/** Every ship id a mission can put on the field. */
function shipIdsOf(mission: CampaignMission): string[] {
  const plan = compileMission(mission, {}, ORIGIN);
  const variants = mission.variants ?? [];
  return [
    ...mission.playerShips,
    ...mission.enemies.map((e) => e.shipId),
    ...(mission.allies ?? []).map((a) => a.shipId),
    ...variants.flatMap((v) =>
      [...(v.addEnemies ?? []), ...(v.addAllies ?? [])].map((s) => s.shipId),
    ),
    ...actionsOf([
      ...(mission.script ?? []),
      ...variants.flatMap((v) => v.script ?? []),
    ]).flatMap((a) => (a.do === "spawn" ? [a.group.shipId] : [])),
    ...[...plan.objectives, ...addedObjectives(plan.script)].flatMap((o) =>
      objectiveSpawns(o).map((s) => s.shipId),
    ),
  ];
}

describe.each(CAMPAIGNS.map((c) => [c.factionId, c] as const))(
  "%s campaign",
  (_id, campaign) => {
    it("has 15 mission slots", () => {
      expect(new Set(campaign.missions.map((m) => m.missionNumber)).size).toBe(
        15,
      );
    });

    it.each(campaign.missions.map((m) => [m.id, m] as const))(
      "%s is fully designed",
      (_m, mission) => {
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
        for (const o of plan.objectives) {
          if (o.type === "escort")
            expect(o.transports.count).toBeLessThanOrEqual(MAX_ESCORT_TARGETS);
        }
      },
    );

    it.each(campaign.missions.map((m) => [m.id, m] as const))(
      "%s references resolve",
      (_m, mission) => {
        const plan = compileMission(mission, {}, ORIGIN);
        const objectiveIds = new Set(
          [...plan.objectives, ...addedObjectives(plan.script)].map(
            (o) => o.id,
          ),
        );
        expect(objectiveIds.size).toBe(
          plan.objectives.length + addedObjectives(plan.script).length,
        );
        const hazardIds = new Set((mission.hazards ?? []).map((h) => h.id));
        const beats = [
          ...(mission.script ?? []),
          ...(mission.variants ?? []).flatMap((v) => v.script ?? []),
        ];
        for (const b of beats) {
          if (b.when.on === "objective")
            expect(objectiveIds, b.when.objectiveId).toContain(
              b.when.objectiveId,
            );
        }
        for (const a of actionsOf(beats)) {
          if (
            a.do === "revealObjective" ||
            a.do === "completeObjective" ||
            a.do === "failObjective"
          ) {
            expect(objectiveIds, a.objectiveId).toContain(a.objectiveId);
          }
          if (a.do === "hazard")
            expect(hazardIds, a.hazardId).toContain(a.hazardId);
        }
      },
    );

    it("covers the SC2-style mission variety", () => {
      const styles = new Set(campaign.missions.map((m) => m.style));
      for (const options of REQUIRED_STYLES) {
        expect(
          options.some((s) => styles.has(s as CampaignMission["style"])),
          options.join("|"),
        ).toBe(true);
      }
    });

    it("carries at least one story consequence into a later mission", () => {
      expect(consequenceFlags(campaign).length).toBeGreaterThan(0);
    });
  },
);

/** Story flags one mission persists and another mission reads. */
function consequenceFlags(campaign: FactionCampaign): string[] {
  const written = new Set<string>();
  const read = new Set<string>();
  for (const m of campaign.missions) {
    for (const flag of Object.keys(m.victoryFlags ?? {})) written.add(flag);
    const beats = [
      ...(m.script ?? []),
      ...(m.variants ?? []).flatMap((v) => v.script ?? []),
    ];
    for (const a of actionsOf(beats))
      if (a.do === "setFlag" && a.persist) written.add(a.flag);
    for (const v of m.variants ?? []) read.add(v.when.flag);
    for (const a of m.allies ?? []) if (a.unlessFlag) read.add(a.unlessFlag);
    for (const b of beats) for (const c of b.if ?? []) read.add(c.flag);
  }
  return [...written].filter((f) => read.has(f));
}

describe("campaign totals", () => {
  it("defines 78 missions across the five factions", () => {
    expect(CAMPAIGNS.reduce((n, c) => n + c.missions.length, 0)).toBe(78);
  });
});
