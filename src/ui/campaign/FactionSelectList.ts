/**
 * FactionSelectList — the campaign faction picker's cards: the five faction
 * campaigns, each with its Rule of N act chip, and the shared Coalition
 * campaign (disabled, with the reason, until Act IV opens). Presentation
 * only; progress is read from the saves and the Chronicle.
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import {
  actNumeral,
  coalitionActStatuses,
  factionActStatuses,
  type ActStatus,
} from "../../campaign/chronicle/actUnlocks";
import type { ChronicleData } from "../../campaign/chronicle/chronicleTypes";
import { startedActsOf } from "../../campaign/hub/hubProgress";
import { slotCount } from "../../campaign/hub/missionGraph";
import {
  COALITION_CAMPAIGN,
  FACTION_CAMPAIGNS,
  type FactionCampaign,
} from "../../data/CampaignData";
import {
  CampaignSaveManager,
  type CampaignSaveData,
} from "../../systems/CampaignSaveManager";
import {
  FACTION_CARD_LAYOUT,
  createFactionCampaignCard,
  type FactionCardProgress,
} from "./FactionCampaignCard";
import type { SelectableCard } from "./SelectableCard";

/** Order of the faction cards. */
export const FACTION_ORDER: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

/** Gap between six cards (they must fit above the footer). */
export const FACTION_LIST_GAP = 8;

/** Wording of an act state on a card chip. */
const STATE_WORD = { complete: "DONE", open: "OPEN", locked: "LOCKED" } as const;

/** Inputs for {@link createFactionSelectCards}. */
export interface FactionListConfig {
  readonly chronicle: ChronicleData;
  readonly centreX: number;
  /** Centre y of the first card. */
  readonly firstY: number;
  readonly onSelectFaction: (factionId: FactionId) => void;
  readonly onSelectCoalition: () => void;
}

/**
 * @param statuses - A campaign's act statuses.
 * @returns "I DONE · II OPEN · III LOCKED".
 */
export function actsLabel(statuses: readonly ActStatus[]): string {
  return statuses
    .map((s) => `${actNumeral(s.act)} ${STATE_WORD[s.state]}`)
    .join(" · ");
}

/**
 * @param campaign - A campaign.
 * @param save - Its playthrough, if any.
 * @returns The progress chip.
 */
function progressOf(
  campaign: FactionCampaign,
  save: CampaignSaveData | null,
): Pick<FactionCardProgress, "label" | "inProgress"> {
  if (!save) return { label: "New Campaign", inProgress: false };
  if (save.campaignComplete)
    return { label: "Campaign Complete", inProgress: true };
  const total = slotCount(campaign);
  return {
    label: `Mission ${Math.min(total, save.currentMission)} / ${total}`,
    inProgress: true,
  };
}

/**
 * @param scene - Owning scene.
 * @param config - Chronicle, geometry and callbacks.
 * @returns The five faction cards then the Coalition card.
 */
export function createFactionSelectCards(
  scene: Phaser.Scene,
  config: FactionListConfig,
): SelectableCard[] {
  const step = FACTION_CARD_LAYOUT.height + FACTION_LIST_GAP;
  const cards = FACTION_ORDER.map((factionId, index) => {
    const campaign = FACTION_CAMPAIGNS[factionId];
    const save = CampaignSaveManager.load(factionId);
    const started = save ? startedActsOf(campaign, save.completedMissions) : [];
    return createFactionCampaignCard(
      scene,
      { x: config.centreX, y: config.firstY + index * step },
      campaign,
      {
        ...progressOf(campaign, save),
        actsLabel: actsLabel(factionActStatuses(config.chronicle, factionId, started)),
      },
      () => config.onSelectFaction(factionId),
    );
  });
  cards.push(createCoalitionCard(scene, config, config.firstY + 5 * step));
  return cards;
}

/**
 * @param scene - Owning scene.
 * @param config - Chronicle and callbacks.
 * @param y - Card centre y.
 * @returns The Coalition card.
 */
function createCoalitionCard(
  scene: Phaser.Scene,
  config: FactionListConfig,
  y: number,
): SelectableCard {
  const save = CampaignSaveManager.load("coalition");
  const started = save
    ? startedActsOf(COALITION_CAMPAIGN, save.completedMissions)
    : [];
  const statuses = coalitionActStatuses(config.chronicle, started);
  const locked = statuses[0]?.state === "locked";
  const campaign: FactionCampaign = {
    ...COALITION_CAMPAIGN,
    factionId: save?.factionId ?? COALITION_CAMPAIGN.factionId,
  };
  const card = createFactionCampaignCard(
    scene,
    { x: config.centreX, y },
    campaign,
    {
      ...progressOf(COALITION_CAMPAIGN, save),
      actsLabel: actsLabel(statuses),
      ...(locked && statuses[0]?.reason ? { note: statuses[0].reason } : {}),
    },
    locked ? undefined : config.onSelectCoalition,
  );
  card.setName("coalition_card");
  return card;
}
