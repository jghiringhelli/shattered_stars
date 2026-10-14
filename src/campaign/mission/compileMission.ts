/**
 * compileMission — turns an authored campaign mission into a runnable plan
 * for one launch: applies story-flag variants, drops allied squadrons whose
 * loss is on record, normalises legacy objectives and resolves every
 * authored offset against the battlefield centre. Pure.
 */

import type { FactionId } from "../../config";
import type {
  ObjectiveDefinition,
  ObjectivePoint,
} from "../../arcade/objectives";
import type {
  CampaignMission,
  MissionAlly,
  MissionEnemy,
  MissionObjective,
} from "../../data/campaign/campaignTypes";
import type { HazardDefinition } from "../hazards/hazardTypes";
import { conditionsHold } from "../scripting/ScriptInterpreter";
import type { ScriptBeat } from "../scripting/scriptTypes";
import { normalizeObjective } from "./normalizeObjective";
import { resolveBeat, resolveHazard, resolveObjective } from "./resolveOffsets";
import { tideBreachBeats } from "./tideBreach";

/** A mission ready to run. */
export interface MissionPlan {
  readonly missionId: string;
  readonly title: string;
  readonly briefing: string;
  readonly objectives: readonly ObjectiveDefinition[];
  readonly script: readonly ScriptBeat[];
  readonly hazards: readonly HazardDefinition[];
  readonly enemies: readonly MissionEnemy[];
  readonly allies: readonly MissionAlly[];
}

/** Faction assumed when a mission's player faction cannot be read. */
const FALLBACK_FACTION: FactionId = "terran_hegemony";

/**
 * @param mission - The mission.
 * @returns Player faction, read from its first player ship's id prefix.
 */
function playerFactionOf(mission: CampaignMission): FactionId {
  const ship = mission.playerShips[0] ?? "";
  if (ship.startsWith("confed_")) return "free_confederation";
  if (ship.startsWith("synth_")) return "synthetic_collective";
  if (ship.startsWith("corsair_")) return "void_corsairs";
  if (ship.startsWith("ascendant_")) return "ascendant_empire";
  return FALLBACK_FACTION;
}

/**
 * @param mission - Authored mission.
 * @param storyFlags - Story flags of the save.
 * @param origin - Battlefield centre (world px).
 * @param factionId - Player faction (defaults to the mission's ships').
 * @returns The plan to run.
 */
export function compileMission(
  mission: CampaignMission,
  storyFlags: Readonly<Record<string, boolean>>,
  origin: ObjectivePoint,
  factionId: FactionId = playerFactionOf(mission),
): MissionPlan {
  const variants = (mission.variants ?? []).filter((v) =>
    conditionsHold([v.when], storyFlags),
  );
  let title = mission.title;
  let briefing = mission.briefing;
  let objectives: readonly MissionObjective[] = mission.objectives;
  const enemies: MissionEnemy[] = [...mission.enemies];
  const allies: MissionAlly[] = [...(mission.allies ?? [])];
  const script: ScriptBeat[] = [...(mission.script ?? [])];
  for (const v of variants) {
    title = v.title ?? title;
    briefing = v.briefing ?? briefing;
    objectives = v.objectives ?? objectives;
    enemies.push(...(v.addEnemies ?? []));
    allies.push(...(v.addAllies ?? []));
    script.push(...(v.script ?? []));
  }
  const resolvedMission = { ...mission, enemies };
  const compiled = objectives.map((o) =>
    resolveObjective(normalizeObjective(o, resolvedMission, factionId), origin),
  );
  script.push(...tideBreachBeats(mission, compiled));
  return {
    missionId: mission.id,
    title,
    briefing,
    objectives: compiled,
    script: script.map((b) => resolveBeat(b, origin)),
    hazards: (mission.hazards ?? []).map((h) => resolveHazard(h, origin)),
    enemies,
    allies: allies.filter(
      (a) =>
        (!a.unlessFlag || storyFlags[a.unlessFlag] !== true) &&
        a.unlessLead !== factionId,
    ),
  };
}
