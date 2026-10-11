/**
 * campaignProgress — pure (Phaser-free) campaign progress rules used by the
 * campaign map and the debrief: mission status, current-act grouping and
 * XP-bar fractions.
 */

import type { CampaignMission, FactionCampaign } from "../../data/CampaignData";
import type { CampaignPilotState } from "../../systems/CampaignSaveManager";
import { XP_THRESHOLDS } from "../../systems/CampaignPilotManager";

/** Progress state of a mission relative to the save. */
export type MissionStatus = "completed" | "not_taken" | "available" | "locked";

/**
 * Classify a mission against campaign progress.
 *
 * @param mission - Mission to classify.
 * @param currentMission - Save's current mission number.
 * @param completedIds - Ids of completed missions.
 * @returns The mission's status.
 */
export function missionStatus(
  mission: CampaignMission,
  currentMission: number,
  completedIds: readonly string[],
): MissionStatus {
  if (completedIds.includes(mission.id)) return "completed";
  if (mission.missionNumber < currentMission) return "not_taken";
  if (mission.missionNumber === currentMission) return "available";
  return "locked";
}

/**
 * Missions of the save's current act, grouped by mission number in order.
 *
 * @param campaign - Faction campaign.
 * @param currentMission - Save's current mission number.
 * @returns Groups (one entry, or two for a branch pair).
 */
export function currentActGroups(
  campaign: FactionCampaign,
  currentMission: number,
): CampaignMission[][] {
  const act =
    campaign.missions.find((m) => m.missionNumber === currentMission)?.act ?? 1;
  const groups = new Map<number, CampaignMission[]>();
  for (const m of campaign.missions.filter((mm) => mm.act === act)) {
    groups.set(m.missionNumber, [...(groups.get(m.missionNumber) ?? []), m]);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, g]) => g);
}

/** Highest skill level with an XP threshold. */
const MAX_SKILL_INDEX = 6;

/** XP bar fill fractions before and after the mission. */
export interface XpProgress {
  readonly preXp: number;
  readonly postXp: number;
  readonly preRatio: number;
  readonly postRatio: number;
}

/**
 * Fill fractions of a pilot's current skill band before and after.
 *
 * @param preXp - XP before the mission.
 * @param pilot - Pilot state after the mission.
 * @returns XP values and gauge fractions (≤ 1; 1 when maxed).
 */
export function xpProgress(
  preXp: number,
  pilot: CampaignPilotState,
): XpProgress {
  const skill = pilot.pilotSkill;
  const levelStart = XP_THRESHOLDS[skill] ?? 0;
  const levelEnd =
    XP_THRESHOLDS[Math.min(skill + 1, MAX_SKILL_INDEX)] ?? levelStart;
  const range = levelEnd - levelStart;
  const ratio = (xp: number): number =>
    range > 0 ? Math.min(1, (xp - levelStart) / range) : 1;
  return {
    preXp,
    postXp: pilot.xp,
    preRatio: ratio(preXp),
    postRatio: ratio(pilot.xp),
  };
}
