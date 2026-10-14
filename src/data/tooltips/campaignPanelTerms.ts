/**
 * CAMPAIGN_PANEL_TERMS - tooltip terms of the Campaign pick panels (squad, armory, research, hero card, hero powers). Pure data.
 */

import { CAMPAIGN_HERO_SQUAD_TERMS } from "./campaignHeroSquadTerms";
import { CAMPAIGN_HUB_TERMS } from "./campaignHubTerms";
import { term } from "./termTypes";

/** Terms owned by the campaign panels (add entries here). */
export const CAMPAIGN_PANEL_TERMS = {
  ...CAMPAIGN_HUB_TERMS,
  ...CAMPAIGN_HERO_SQUAD_TERMS,
} as const satisfies Record<string, ReturnType<typeof term>>;
