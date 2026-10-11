/**
 * campaignCompletion — the completion screen's content: the epilogue lines
 * this playthrough earned (flag-conditioned lines included only when their
 * story flag holds) and the service record summary. Pure.
 */

import type { FactionId } from "../../config";
import {
  CAMPAIGN_EPILOGUES,
  type EpilogueLine,
} from "../../data/campaign/epilogues";
import { chosenResearchOptions } from "../armory/researchRules";
import { conditionsHold } from "../scripting/ScriptInterpreter";
import type { CampaignSaveData } from "../save/campaignSaveTypes";

/** One labelled figure of the service record. */
export interface RecordEntry {
  readonly label: string;
  readonly value: string;
}

/**
 * @param factionId - Campaign faction.
 * @param flags - Story flags of the save.
 * @returns The epilogue lines this playthrough earned, in order.
 */
export function epilogueLines(
  factionId: FactionId,
  flags: Readonly<Record<string, boolean>>,
): EpilogueLine[] {
  return CAMPAIGN_EPILOGUES[factionId].filter(
    (line) => !line.when || conditionsHold([line.when], flags),
  );
}

/**
 * @param save - Completed playthrough.
 * @returns Its service record.
 */
export function serviceRecord(save: CampaignSaveData): RecordEntry[] {
  const research = chosenResearchOptions(save.research).map((o) => o.name);
  return [
    { label: "MISSIONS FLOWN", value: `${save.completedMissions.length}` },
    { label: "ENEMIES DESTROYED", value: `${save.totalKills}` },
    { label: "SHIPS LOST", value: `${save.shipsLost}` },
    {
      label: "BONUS OBJECTIVES",
      value: `${save.bonusObjectivesCompleted.length}`,
    },
    {
      label: "RESEARCH",
      value: research.length > 0 ? research.join(", ") : "None",
    },
    { label: "CREDITS IN THE BANK", value: `${save.credits}` },
  ];
}
