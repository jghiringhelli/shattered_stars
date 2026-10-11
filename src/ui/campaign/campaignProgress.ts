/**
 * campaignProgress — pure (Phaser-free) campaign progress helpers used by the
 * hub mission board and the debrief: act grouping and XP-bar fractions.
 * Mission availability lives in src/campaign/hub/missionGraph.ts.
 */

import type { CampaignMission, FactionCampaign } from "../../data/CampaignData";
import type { CampaignPilotState } from "../../systems/CampaignSaveManager";
import { XP_THRESHOLDS } from "../../systems/CampaignPilotManager";
import type { HubMissionStatus } from "../../campaign/hub/missionGraph";

/** Hub state of a mission (rules in missionGraph). */
export type MissionStatus = HubMissionStatus;

/**
 * Missions of one act, grouped by mission number in order.
 *
 * @param campaign - Faction campaign.
 * @param currentMission - A mission number inside the act to show.
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
