/**
 * ResearchPanel — the hub's Research tab: one row per tier with its two
 * mutually exclusive options. Locked tiers show the research points still
 * needed; a chosen tier shows CHOSEN / NOT CHOSEN for good; an open tier
 * needs a confirming second click (choices are permanent).
 */

import type Phaser from "phaser";
import {
  RESEARCH_TREE,
  type ResearchPick,
  type ResearchTier,
} from "../../data/campaign/research";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { CAMPAIGN_TEXT, addHoloText } from "./campaignUi";
import { SelectableCard } from "./SelectableCard";

/** Panel layout (screen px). */
export const RESEARCH_LAYOUT = {
  x: 32,
  top: 104,
  width: 640,
  height: 520,
  padding: 16,
  header: 28,
  rowHeight: 112,
  rowGap: 6,
  cardGap: 12,
  cardHeight: 84,
} as const;

/** Inputs of the panel. */
export interface ResearchPanelConfig {
  readonly points: number;
  readonly choices: Readonly<Record<string, ResearchPick>>;
  /** Option awaiting confirmation ("tierId:A"), if any. */
  readonly pending: string | null;
  readonly accent: number;
  readonly onPick: (tier: ResearchTier, pick: ResearchPick) => void;
}

/** Built panel plus its selectable cards. */
export interface ResearchPanelView {
  readonly panel: HoloPanel;
  readonly cards: SelectableCard[];
}

/**
 * @param scene - Owning scene.
 * @param config - Points, choices, pending pick, accent, pick callback.
 * @returns The panel and its open option cards.
 */
export function createResearchPanel(
  scene: Phaser.Scene,
  config: ResearchPanelConfig,
): ResearchPanelView {
  const L = RESEARCH_LAYOUT;
  const panel = createHoloPanel(
    scene,
    L.x + L.width / 2,
    L.top + L.height / 2,
    {
      width: L.width,
      height: L.height,
      accentColor: config.accent,
      title: `RESEARCH · ${config.points} POINTS EARNED`,
    },
  );
  const cards: SelectableCard[] = [];
  const innerWidth = L.width - L.padding * 2;
  const cardWidth = (innerWidth - L.cardGap) / 2;
  RESEARCH_TREE.forEach((tier, row) => {
    const top =
      -L.height / 2 + L.header + L.padding + row * (L.rowHeight + L.rowGap);
    const locked = config.points < tier.requiredPoints;
    const caption = locked
      ? `${tier.name.toUpperCase()} · LOCKED (${tier.requiredPoints} POINTS)`
      : tier.name.toUpperCase();
    panel.add(
      addHoloText(scene, -innerWidth / 2, top, caption, CAMPAIGN_TEXT.caption),
    );
    (["A", "B"] as const).forEach((pick, col) => {
      const x = -innerWidth / 2 + cardWidth / 2 + col * (cardWidth + L.cardGap);
      const card = optionCard(
        scene,
        { tier, pick, locked },
        { x, y: top + 18 + L.cardHeight / 2, width: cardWidth },
        config,
      );
      panel.add(card);
      if (card.enabled) cards.push(card);
    });
  });
  return { panel, cards };
}

/**
 * @param scene - Owning scene.
 * @param option - Tier, side and lock state.
 * @param place - Card centre and width.
 * @param config - Panel inputs.
 * @returns The option card.
 */
function optionCard(
  scene: Phaser.Scene,
  option: { tier: ResearchTier; pick: ResearchPick; locked: boolean },
  place: { x: number; y: number; width: number },
  config: ResearchPanelConfig,
): SelectableCard {
  const L = RESEARCH_LAYOUT;
  const { tier, pick, locked } = option;
  const data = pick === "A" ? tier.optionA : tier.optionB;
  const chosen = config.choices[tier.id];
  const open = !locked && chosen === undefined;
  const confirming = config.pending === `${tier.id}:${pick}`;
  const state =
    chosen === pick
      ? "CHOSEN"
      : chosen
        ? "NOT CHOSEN"
        : locked
          ? "LOCKED"
          : confirming
            ? "CLICK AGAIN TO CONFIRM (PERMANENT)"
            : "CHOOSE";
  const card = new SelectableCard(
    scene,
    place.x,
    place.y,
    {
      width: place.width,
      height: L.cardHeight,
      accent: config.accent,
      idleBorder:
        chosen === pick
          ? HOLO_PALETTE.success
          : confirming
            ? HOLO_PALETTE.warning
            : HOLO_PALETTE.border,
      idleBorderAlpha: open || chosen === pick ? 1 : 0.35,
    },
    open ? () => config.onPick(tier, pick) : undefined,
  );
  const left = card.left + 10;
  const dim = !open && chosen !== pick;
  card.add([
    addHoloText(scene, left, -L.cardHeight / 2 + 8, data.name, {
      size: 14,
      weight: "600",
      color: dim ? HOLO_PALETTE.textMuted : HOLO_PALETTE.textPrimary,
    }),
    addHoloText(scene, left, -L.cardHeight / 2 + 28, data.description, {
      ...CAMPAIGN_TEXT.body,
      size: 12,
      wrapWidth: place.width - 20,
    }),
    addHoloText(scene, left, L.cardHeight / 2 - 18, state, {
      ...CAMPAIGN_TEXT.caption,
      color:
        chosen === pick
          ? HOLO_PALETTE.success
          : confirming
            ? HOLO_PALETTE.warning
            : dim
              ? HOLO_PALETTE.textMuted
              : config.accent,
    }),
  ]);
  return card;
}
