/**
 * campaignBonuses — folds the installed Armory mods and chosen Research
 * options into one {@link CampaignShipBonuses} record (multipliers multiply,
 * everything else adds). Pure.
 */

import { getArmoryMod } from "../../data/campaign/armory";
import type { ArmoryLedger } from "./armoryRules";
import {
  MULTIPLICATIVE_BONUSES,
  NEUTRAL_BONUSES,
  type CampaignShipBonuses,
} from "./bonusTypes";
import { chosenResearchOptions, type ResearchChoices } from "./researchRules";

/**
 * @param base - Accumulated bonuses.
 * @param extra - Bonuses to fold in.
 * @returns The combination.
 */
export function combineBonuses(
  base: CampaignShipBonuses,
  extra: Partial<CampaignShipBonuses>,
): CampaignShipBonuses {
  const result: Record<string, number> = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) continue;
    const field = key as keyof CampaignShipBonuses;
    result[field] = MULTIPLICATIVE_BONUSES.has(field)
      ? (result[field] ?? 1) * value
      : (result[field] ?? 0) + value;
  }
  return result as unknown as CampaignShipBonuses;
}

/**
 * @param armory - Installed mods.
 * @param research - Research choices.
 * @returns Every bonus the squad flies with.
 */
export function campaignBonuses(
  armory: ArmoryLedger,
  research: ResearchChoices,
): CampaignShipBonuses {
  const modBonuses = Object.keys(armory.installed)
    .map((id) => getArmoryMod(id)?.bonuses)
    .filter((b): b is Partial<CampaignShipBonuses> => b !== undefined);
  const researchBonuses = chosenResearchOptions(research).map((o) => o.bonuses);
  return [...modBonuses, ...researchBonuses].reduce(
    combineBonuses,
    NEUTRAL_BONUSES,
  );
}
