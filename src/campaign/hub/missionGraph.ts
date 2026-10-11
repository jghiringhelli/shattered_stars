/**
 * missionGraph — which campaign missions the hub offers (SC2 Wings of
 * Liberty-style non-linear selection). Default rules per act of
 * {@link ACT_LENGTH} slots: the opener follows the previous act's finale;
 * the middle missions open together after the opener (act I teaches one
 * step at a time first: 1 → 2 → {3, 4}); the finale needs every middle
 * slot. A slot is done when any mission in it is done, so a branch pair's
 * other option becomes "not taken". Missions may override with explicit
 * prerequisite slots. Pure.
 */

import type {
  CampaignMission,
  FactionCampaign,
} from "../../data/campaign/campaignTypes";

/** Mission slots per act. */
export const ACT_LENGTH = 5;
/** Slot after which act I's middle missions open. */
const TUTORIAL_GATE_SLOT = 2;

/** Hub state of a mission. */
export type HubMissionStatus =
  "completed" | "available" | "locked" | "not_taken";

/** The save fields availability reads. */
export interface HubProgress {
  readonly completedMissions: readonly string[];
  readonly storyFlags: Readonly<Record<string, boolean>>;
}

/**
 * @param missionNumber - A mission slot (1-based).
 * @returns Slots that must be done before it, by the default act rules.
 */
export function defaultPrerequisites(missionNumber: number): number[] {
  const position = ((missionNumber - 1) % ACT_LENGTH) + 1;
  const actStart = missionNumber - position + 1;
  const middle = [actStart + 1, actStart + 2, actStart + 3];
  if (missionNumber === 1) return [];
  if (position === 1) return [missionNumber - 1];
  if (position === ACT_LENGTH) {
    return actStart === 1
      ? [TUTORIAL_GATE_SLOT + 1, TUTORIAL_GATE_SLOT + 2]
      : middle;
  }
  if (actStart === 1)
    return missionNumber <= TUTORIAL_GATE_SLOT ? [1] : [TUTORIAL_GATE_SLOT];
  return [actStart];
}

/**
 * @param campaign - Faction campaign.
 * @param completedIds - Completed mission ids.
 * @returns Slots with a completed mission.
 */
function doneSlots(
  campaign: FactionCampaign,
  completedIds: readonly string[],
): Set<number> {
  return new Set(
    campaign.missions
      .filter((m) => completedIds.includes(m.id))
      .map((m) => m.missionNumber),
  );
}

/**
 * @param mission - A mission.
 * @param campaign - Its campaign.
 * @param progress - Save progress.
 * @returns Its hub status.
 */
export function hubMissionStatus(
  mission: CampaignMission,
  campaign: FactionCampaign,
  progress: HubProgress,
): HubMissionStatus {
  if (progress.completedMissions.includes(mission.id)) return "completed";
  const done = doneSlots(campaign, progress.completedMissions);
  if (done.has(mission.missionNumber)) return "not_taken";
  const required =
    mission.prerequisites ?? defaultPrerequisites(mission.missionNumber);
  return required.every((slot) => done.has(slot)) ? "available" : "locked";
}

/**
 * @param campaign - Faction campaign.
 * @param progress - Save progress.
 * @returns Missions the hub offers now, in slot order.
 */
export function availableMissions(
  campaign: FactionCampaign,
  progress: HubProgress,
): CampaignMission[] {
  return campaign.missions
    .filter((m) => hubMissionStatus(m, campaign, progress) === "available")
    .sort((a, b) => a.missionNumber - b.missionNumber);
}

/**
 * @param mission - A mission.
 * @param campaign - Its campaign.
 * @returns Whether it sits in the campaign's last slot.
 */
export function isFinaleMission(
  mission: CampaignMission,
  campaign: FactionCampaign,
): boolean {
  const last = Math.max(...campaign.missions.map((m) => m.missionNumber));
  return mission.missionNumber === last;
}

/**
 * @param mission - A mission.
 * @returns Its branch slot key ("slot_<n>") when it is one of a branch pair.
 */
export function branchSlotKey(mission: CampaignMission): string | undefined {
  return mission.isBranch ? `slot_${mission.missionNumber}` : undefined;
}

/**
 * @param campaign - Faction campaign.
 * @returns Number of mission slots.
 */
export function slotCount(campaign: FactionCampaign): number {
  return new Set(campaign.missions.map((m) => m.missionNumber)).size;
}
