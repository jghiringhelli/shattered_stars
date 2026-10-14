/**
 * campaignCompletion — the completion screen's content: the epilogue lines
 * this playthrough earned (flag-conditioned lines included only when their
 * story flag holds) and the service record summary. Pure.
 */

import type { FactionId } from "../../config";
import { CAMPAIGN_LORE } from "../../data/CampaignData";
import type { EndingId } from "../../data/campaign/crossovers";
import { ENDING_EPILOGUES } from "../../data/campaign/coalitionEpilogues";
import {
  CAMPAIGN_EPILOGUES,
  type EpilogueLine,
} from "../../data/campaign/epilogues";
import type { EpiloguePatch } from "../../data/campaign/loreTypes";
import { chosenResearchOptions } from "../armory/researchRules";
import { conditionsHold } from "../scripting/ScriptInterpreter";
import type { CampaignSaveData } from "../save/campaignSaveTypes";

/** One labelled figure of the service record. */
export interface RecordEntry {
  readonly label: string;
  readonly value: string;
}

/**
 * Applies the lore bible\u0027s epilogue edits: text swaps over the existing
 * lines, and new lines slotted in before the closing line.
 *
 * @param base - A faction\u0027s shipped epilogue.
 * @param patch - The edits, if any.
 * @returns The patched epilogue.
 */
export function applyEpiloguePatch(
  base: readonly EpilogueLine[],
  patch: EpiloguePatch | undefined,
): EpilogueLine[] {
  const swapped = base.map((line) =>
    (patch?.swaps ?? []).reduce(
      (current, [from, to]) => ({
        ...current,
        text: current.text.split(from).join(to),
      }),
      line,
    ),
  );
  const added = patch?.add ?? [];
  if (added.length === 0 || swapped.length === 0) return [...swapped, ...added];
  return [...swapped.slice(0, -1), ...added, swapped[swapped.length - 1]!];
}

/**
 * @param factionId - Campaign faction.
 * @param flags - Story flags of the playthrough (the Chronicle\u0027s included).
 * @returns The epilogue lines this playthrough earned, in order.
 */
export function epilogueLines(
  factionId: FactionId,
  flags: Readonly<Record<string, boolean>>,
): EpilogueLine[] {
  return applyEpiloguePatch(
    CAMPAIGN_EPILOGUES[factionId],
    CAMPAIGN_LORE[factionId].epilogue,
  ).filter((line) => !line.when || conditionsHold([line.when], flags));
}

/**
 * @param ending - The Act V ending chosen.
 * @param flags - Story flags of the playthrough (the Chronicle\u0027s included).
 * @returns Its epilogue lines (flag-conditioned lines only when they hold).
 */
export function endingEpilogueLines(
  ending: EndingId,
  flags: Readonly<Record<string, boolean>>,
): EpilogueLine[] {
  return ENDING_EPILOGUES[ending].filter(
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
