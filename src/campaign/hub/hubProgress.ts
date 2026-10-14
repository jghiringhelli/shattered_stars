/**
 * hubProgress — what the campaign hub reads from a playthrough: the Rule of N
 * status of each act (with its lock reason), the acts that hold progress
 * already (never taken away) and the progress object mission availability
 * uses. Pure.
 */

import type { FactionCampaign } from "../../data/campaign/campaignTypes";
import {
  coalitionActStatuses,
  factionActStatuses,
  lockedActsOf,
  type ActStatus,
} from "../chronicle/actUnlocks";
import type { ChronicleData } from "../chronicle/chronicleTypes";
import { COALITION_SLOT, type CampaignSaveData } from "../save/campaignSaveTypes";
import type { HubProgress } from "./missionGraph";

/** The hub's view of a playthrough. */
export interface HubView extends HubProgress {
  /** Status of every act of the campaign, in story order. */
  readonly statuses: readonly ActStatus[];
}

/**
 * @param campaign - The campaign.
 * @param completedMissions - Completed mission ids.
 * @returns Acts in which at least one mission was completed.
 */
export function startedActsOf(
  campaign: FactionCampaign,
  completedMissions: readonly string[],
): number[] {
  return [
    ...new Set(
      campaign.missions
        .filter((m) => completedMissions.includes(m.id))
        .map((m) => m.act),
    ),
  ];
}

/**
 * @param campaign - The campaign being played.
 * @param save - Its playthrough.
 * @param chronicle - The Chronicle.
 * @returns Act statuses, locked acts and the progress mission availability reads.
 */
export function hubViewOf(
  campaign: FactionCampaign,
  save: CampaignSaveData,
  chronicle: ChronicleData,
): HubView {
  const started = startedActsOf(campaign, save.completedMissions);
  const statuses =
    save.slot === COALITION_SLOT
      ? coalitionActStatuses(chronicle, started)
      : factionActStatuses(chronicle, save.factionId, started);
  return {
    completedMissions: save.completedMissions,
    storyFlags: save.storyFlags,
    lockedActs: lockedActsOf(statuses),
    statuses,
  };
}
