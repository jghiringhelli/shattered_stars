/**
 * FactionCampaignCard — one row of the campaign faction picker: accent bar,
 * faction emblem, campaign title, description and a progress chip.
 */

import type Phaser from "phaser";
import type { FactionCampaign } from "../../data/CampaignData";
import { HOLO_PALETTE, HOLO_SPACING, factionAccent } from "../theme/HoloTheme";
import { SelectableCard } from "./SelectableCard";
import {
  CAMPAIGN_TEXT,
  addCaptionChip,
  addHoloText,
  drawFactionEmblem,
} from "./campaignUi";

/** Faction card layout (local to the card centre). */
export const FACTION_CARD_LAYOUT = {
  width: 800,
  height: 88,
  gap: 12,
  emblemX: 48,
  emblemRadius: 22,
  textX: 88,
  titleY: -12,
  descriptionY: 14,
  descriptionSize: 13,
  chipGap: 28,
} as const;

/** Progress shown on a faction card. */
export interface FactionCardProgress {
  /** Chip text, e.g. "New Campaign" or "Mission 3 / 15". */
  readonly label: string;
  /** True when a save exists for the faction. */
  readonly inProgress: boolean;
  /** Act chip text, e.g. "I DONE · II OPEN · III LOCKED". */
  readonly actsLabel?: string;
  /** Replaces the description (a lock reason). */
  readonly note?: string;
}

/**
 * Build a faction campaign card.
 *
 * @param scene - Owning scene.
 * @param position - Card centre.
 * @param campaign - Campaign shown on the card.
 * @param progress - Progress chip text and state.
 * @param onSelect - Invoked when the card is pressed / activated (omit to
 *   show the card disabled).
 * @returns The interactive card.
 */
export function createFactionCampaignCard(
  scene: Phaser.Scene,
  position: { readonly x: number; readonly y: number },
  campaign: FactionCampaign,
  progress: FactionCardProgress,
  onSelect?: () => void,
): SelectableCard {
  const L = FACTION_CARD_LAYOUT;
  const accent = factionAccent(campaign.factionId);
  const card = new SelectableCard(
    scene,
    position.x,
    position.y,
    { width: L.width, height: L.height, accent, accentBar: true },
    onSelect,
  );
  const emblem = scene.add.graphics();
  drawFactionEmblem(
    emblem,
    campaign.factionId,
    { x: card.left + L.emblemX, y: 0 },
    L.emblemRadius,
    accent,
  );
  const textX = card.left + L.textX;
  const title = addHoloText(scene, textX, L.titleY, campaign.name, {
    ...CAMPAIGN_TEXT.heading,
  }).setOrigin(0, 0.5);
  const description = addHoloText(
    scene,
    textX,
    L.descriptionY,
    progress.note ?? campaign.description,
    {
      ...CAMPAIGN_TEXT.body,
      size: L.descriptionSize,
      wrapWidth: card.right - HOLO_SPACING.xl - textX,
    },
  ).setOrigin(0, 0.5);
  const chip = addCaptionChip(
    scene,
    card.right - HOLO_SPACING.xl,
    L.titleY,
    progress.label,
    progress.inProgress ? HOLO_PALETTE.success : HOLO_PALETTE.textSecondary,
  );
  card.add([emblem, title, description, chip]);
  if (progress.actsLabel) {
    const acts = addCaptionChip(
      scene,
      card.right - HOLO_SPACING.xl - chip.getBounds().width - L.chipGap,
      L.titleY,
      progress.actsLabel,
      HOLO_PALETTE.textMuted,
    );
    acts.setName(`acts_chip_${campaign.factionId}`);
    card.add(acts);
  }
  return card;
}
