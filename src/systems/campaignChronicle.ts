/**
 * campaignChronicle — glue between a campaign mission and the Chronicle: the
 * flags a mission is played with (the save's plus the shared canon and the
 * Coalition lead markers), the story flags a second witness may still save,
 * and folding a win into the Chronicle. Not Phaser-bound.
 */

import { campaignOfMission } from "../data/CampaignData";
import type { CampaignMission } from "../data/campaign/campaignTypes";
import {
  canonFilter,
  completedActs,
  effectiveFlags,
} from "../campaign/chronicle/chronicleRules";
import { leadFlags } from "../campaign/coalition/coalitionLaunch";
import type { MissionCompletionRecord } from "../campaign/save/missionCompletion";
import {
  COALITION_SLOT,
  type CampaignSaveData,
} from "../campaign/save/campaignSaveTypes";
import { ChronicleManager } from "./ChronicleManager";

/**
 * @param save - The playthrough.
 * @returns Flags to play with: the save's, the Chronicle's canon and, in the
 *   Coalition, `lead_<faction>`.
 */
export function campaignPlayFlags(
  save: CampaignSaveData,
): Record<string, boolean> {
  const lead = save.slot === COALITION_SLOT ? leadFlags(save.factionId) : {};
  return effectiveFlags(save.storyFlags ?? {}, ChronicleManager.load(), lead);
}

/**
 * @param record - What a won mission adds to the save.
 * @returns The record without the exclusive flags a second witness may not
 *   write (the first witness already set canon).
 */
export function canonRecord(
  record: MissionCompletionRecord,
): MissionCompletionRecord {
  if (!record.storyFlags) return record;
  return {
    ...record,
    storyFlags: canonFilter(record.storyFlags, ChronicleManager.load().flags),
  };
}

/**
 * Folds a won mission into the Chronicle (shared flags, crossover canon and
 * act completion).
 *
 * @param mission - The mission won.
 * @param record - The record saved for it (already canon-filtered).
 * @param save - The playthrough after the win.
 */
export function recordCampaignVictory(
  mission: CampaignMission,
  record: MissionCompletionRecord,
  save: CampaignSaveData,
): void {
  const campaign = campaignOfMission(mission, save.factionId);
  ChronicleManager.recordVictory({
    missionId: mission.id,
    faction: save.factionId,
    campaignId: save.slot === COALITION_SLOT ? COALITION_SLOT : save.factionId,
    storyFlags: record.storyFlags ?? {},
    actsComplete: completedActs(campaign, save.completedMissions),
  });
}
