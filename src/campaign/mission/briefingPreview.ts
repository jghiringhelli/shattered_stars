/**
 * briefingPreview — the mission as this playthrough will fly it, for the
 * hub briefing: story-flag variants applied (title, briefing, tagline,
 * objectives). Pure.
 */

import type { FactionId } from "../../config";
import type { CampaignMission } from "../../data/campaign/campaignTypes";
import { conditionsHold } from "../scripting/ScriptInterpreter";
import { compileMission } from "./compileMission";

/** Origin for previews (geometry is irrelevant to a briefing). */
const PREVIEW_ORIGIN = { x: 0, y: 0 } as const;

/**
 * @param mission - Authored mission.
 * @param storyFlags - Story flags of the save.
 * @param factionId - Player faction.
 * @returns The mission with its active variant's text and objectives.
 */
export function briefedMission(
  mission: CampaignMission,
  storyFlags: Readonly<Record<string, boolean>>,
  factionId: FactionId,
): CampaignMission {
  const plan = compileMission(mission, storyFlags, PREVIEW_ORIGIN, factionId);
  const tagline = (mission.variants ?? [])
    .filter((v) => conditionsHold([v.when], storyFlags))
    .reduce<string | undefined>(
      (current, v) => v.tagline ?? current,
      mission.tagline,
    );
  return {
    ...mission,
    title: plan.title,
    briefing: plan.briefing,
    objectives: [...plan.objectives],
    ...(tagline !== undefined ? { tagline } : {}),
  };
}
