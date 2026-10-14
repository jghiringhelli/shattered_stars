/**
 * Shared fixtures of the Coalition content tests: the eight missions merged
 * with their designs (the same merge withDesigns in src/data/CampaignData.ts
 * applies) and the helpers that read ids, flags and portraits from them.
 */

import { compileMission } from "../../../src/campaign/mission/compileMission";
import { objectiveSpawns, type ObjectiveDefinition } from "../../../src/arcade/objectives";
import type { ScriptAction, ScriptBeat } from "../../../src/campaign/scripting/scriptTypes";
import { FACTION_CAMPAIGNS } from "../../../src/data/CampaignData";
import type { CampaignMission, MissionDesign } from "../../../src/data/campaign/campaignTypes";
import { COALITION_DESIGNS } from "../../../src/data/campaign/designs/coalition";
import { CAMPAIGN_EPILOGUES } from "../../../src/data/campaign/epilogues";
import { COALITION_MISSIONS } from "../../../src/data/campaign/missions/coalition";

export const ORIGIN = { x: 3000, y: 3000 };
export const FACTIONS = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
] as const;
export const MAX_DEBRIEF_CHARACTERS = 140;
/** Highest reward of a faction Act III finale: the Coalition must pay more. */
export const ACT_THREE_FINALE_XP = 1000;
export const EXPECTED_PREREQUISITES: Readonly<Record<string, readonly number[]>> = {
  coal_4_1: [],
  coal_4_2: [1],
  coal_4_3: [1],
  coal_4_4: [1],
  coal_4_5: [2, 3, 4],
  coal_5_1: [5],
  coal_5_2: [6],
  coal_5_3: [7],
};

/** The same 3-line merge withDesigns (src/data/CampaignData.ts) applies. */
export const MISSIONS: CampaignMission[] = COALITION_MISSIONS.map((mission) => {
  const design: MissionDesign | undefined = COALITION_DESIGNS[mission.id];
  if (!design) return mission;
  return {
    ...mission,
    ...design,
    objectives: design.objectives ?? mission.objectives,
  };
});

export const actionsOf = (beats: readonly ScriptBeat[]): ScriptAction[] =>
  beats.flatMap((b) => b.actions);
export const beatsOf = (mission: CampaignMission): ScriptBeat[] => [
  ...(mission.script ?? []),
  ...(mission.variants ?? []).flatMap((v) => v.script ?? []),
];
export const addedObjectives = (beats: readonly ScriptBeat[]): ObjectiveDefinition[] =>
  actionsOf(beats).flatMap((a) =>
    a.do === "addObjective" ? [a.objective] : [],
  );

/** Every ship or creature id a mission can put on the field. */
export function shipIdsOf(mission: CampaignMission): string[] {
  const plan = compileMission(mission, {}, ORIGIN);
  const variants = mission.variants ?? [];
  return [
    ...mission.playerShips,
    ...mission.enemies.map((e) => e.shipId),
    ...(mission.allies ?? []).map((a) => a.shipId),
    ...variants.flatMap((v) =>
      [...(v.addEnemies ?? []), ...(v.addAllies ?? [])].map((s) => s.shipId),
    ),
    ...actionsOf(beatsOf(mission)).flatMap((a) =>
      a.do === "spawn" ? [a.group.shipId] : [],
    ),
    ...[...plan.objectives, ...addedObjectives(plan.script)].flatMap((o) =>
      objectiveSpawns(o).map((s) => s.shipId),
    ),
  ];
}

/** Flags a mission persists on victory. */
export function persisted(mission: CampaignMission): string[] {
  const fromBeats = actionsOf(beatsOf(mission)).flatMap((a) =>
    a.do === "setFlag" && a.persist ? [a.flag] : [],
  );
  return [...Object.keys(mission.victoryFlags ?? {}), ...fromBeats];
}

/** Flags a mission reads from the save (variants, allies, beat conditions, flag triggers). */
export function readFlags(mission: CampaignMission): string[] {
  const beats = beatsOf(mission);
  return [
    ...(mission.variants ?? []).map((v) => v.when.flag),
    ...(mission.allies ?? []).flatMap((a) =>
      a.unlessFlag ? [a.unlessFlag] : [],
    ),
    ...beats.flatMap((b) => (b.if ?? []).map((c) => c.flag)),
    ...beats.flatMap((b) => (b.when.on === "flag" ? [b.when.flag] : [])),
  ];
}

export const LEAD_FLAGS = new Set(FACTIONS.map((f) => `lead_${f}`));
export const WRITTEN = new Set(MISSIONS.flatMap(persisted));
export const KNOWN_PORTRAITS = new Set([
  ...Object.values(FACTION_CAMPAIGNS).flatMap((c) =>
    c.missions.flatMap((m) => [
      ...(m.debrief ?? []).map((d) => d.portraitKey),
      ...actionsOf(beatsOf(m)).flatMap((a) =>
        a.do === "say" ? [a.portraitKey] : [],
      ),
    ]),
  ),
  ...Object.values(CAMPAIGN_EPILOGUES).flatMap((lines) =>
    lines.map((l) => l.portraitKey),
  ),
]);

