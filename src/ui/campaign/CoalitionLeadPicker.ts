/**
 * CoalitionLeadPicker — the roster choice that opens the Coalition campaign:
 * which hero leads (their faction's ships and hero powers). One card per
 * faction hero. Presentation only.
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import {
  COALITION_LEADS,
  LEAD_HEROES,
} from "../../campaign/coalition/coalitionLaunch";
import { FACTION_CAMPAIGNS } from "../../data/CampaignData";
import {
  FACTION_CARD_LAYOUT,
  createFactionCampaignCard,
} from "./FactionCampaignCard";
import type { SelectableCard } from "./SelectableCard";

/** Gap between the lead cards. */
const LEAD_CARD_GAP = 16;

/** Inputs for {@link createLeadCards}. */
export interface LeadPickerConfig {
  readonly centreX: number;
  readonly firstY: number;
  readonly onPick: (lead: FactionId) => void;
}

/**
 * @param scene - Owning scene.
 * @param config - Geometry and callback.
 * @returns One card per possible lead hero.
 */
export function createLeadCards(
  scene: Phaser.Scene,
  config: LeadPickerConfig,
): SelectableCard[] {
  const step = FACTION_CARD_LAYOUT.height + LEAD_CARD_GAP;
  return COALITION_LEADS.map((lead, index) => {
    const hero = LEAD_HEROES[lead];
    const card = createFactionCampaignCard(
      scene,
      { x: config.centreX, y: config.firstY + index * step },
      { ...FACTION_CAMPAIGNS[lead], name: hero.name, description: hero.powers },
      { label: "LEAD", inProgress: true },
      () => config.onPick(lead),
    );
    card.setName(`lead_card_${lead}`);
    return card;
  });
}
