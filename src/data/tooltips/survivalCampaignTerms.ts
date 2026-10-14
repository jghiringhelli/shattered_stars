/**
 * SURVIVAL_CAMPAIGN_TERMS - tooltip terms of: Survival (starter, shop, relics, powers) and Campaign (squad, armory, research, hero card). Pure data.
 */

import { CAMPAIGN_PANEL_TERMS } from "./campaignPanelTerms";
import { SURVIVAL_ECONOMY_TERMS } from "./survivalEconomyTerms";
import { SURVIVAL_POWER_TERMS } from "./survivalPowerTerms";
import { SURVIVAL_TAG_TERMS } from "./survivalTagTerms";
import { term } from "./termTypes";

/** Terms owned by this feature area (add entries here). */
export const SURVIVAL_CAMPAIGN_TERMS = {
  ...CAMPAIGN_PANEL_TERMS,
  ...SURVIVAL_TAG_TERMS,
  ...SURVIVAL_POWER_TERMS,
  ...SURVIVAL_ECONOMY_TERMS,
} as const satisfies Record<string, ReturnType<typeof term>>;
