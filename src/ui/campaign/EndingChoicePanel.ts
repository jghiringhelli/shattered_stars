/**
 * EndingChoicePanel — Act V's final choice on the completion screen: Answer,
 * Sever or Seal as cards (the ones the Chronicle does not allow are shown
 * disabled with what they need), with the unity and key tallies behind them.
 * Presentation only.
 */

import type Phaser from "phaser";
import {
  KEYS_FOR_ANSWER,
  UNITY_FOR_ANSWER,
  UNITY_FOR_SEVER,
  type EndingOptions,
} from "../../campaign/chronicle/endings";
import { ENDING_TEXT } from "../../data/campaign/coalitionEpilogues";
import type { EndingId } from "../../data/campaign/crossovers";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { CAMPAIGN_TEXT, addCaptionChip, addHoloText } from "./campaignUi";
import { SelectableCard } from "./SelectableCard";

/** Endings the player picks between, best first. */
const CHOICES: readonly EndingId[] = ["answer", "sever", "seal"];

/** Layout (screen px). */
export const ENDING_CHOICE_LAYOUT = {
  x: 40,
  top: 110,
  width: 720,
  height: 470,
  padding: 22,
  header: 28,
  cardHeight: 110,
  cardGap: 14,
  tallyHeight: 24,
} as const;

/** Inputs for {@link createEndingChoice}. */
export interface EndingChoiceConfig {
  readonly options: EndingOptions;
  readonly accent: number;
  readonly onChoose: (ending: EndingId) => void;
}

/** Built panel and its keyboard targets. */
export interface EndingChoiceView {
  readonly panel: HoloPanel;
  readonly cards: readonly SelectableCard[];
}

/**
 * @param ending - An ending.
 * @returns What it needs, for a disabled card.
 */
export function requirementOf(ending: EndingId): string {
  if (ending === "answer")
    return `Needs all ${KEYS_FOR_ANSWER} keys and Unity ${UNITY_FOR_ANSWER}`;
  if (ending === "sever") return `Needs Unity ${UNITY_FOR_SEVER}`;
  return "Always available";
}

/**
 * @param scene - Owning scene.
 * @param config - Tallies, accent and callback.
 * @returns The panel and its cards.
 */
export function createEndingChoice(
  scene: Phaser.Scene,
  config: EndingChoiceConfig,
): EndingChoiceView {
  const L = ENDING_CHOICE_LAYOUT;
  const panel = createHoloPanel(scene, L.x + L.width / 2, L.top + L.height / 2, {
    width: L.width,
    height: L.height,
    accentColor: config.accent,
    title: "THE FINAL CHOICE",
  });
  const left = -L.width / 2 + L.padding;
  const top = -L.height / 2 + L.header + L.padding;
  panel.add(
    addHoloText(
      scene,
      left,
      top,
      `UNITY ${config.options.unity} / 12  ·  KEYS ${config.options.keys} / ${KEYS_FOR_ANSWER}`,
      { ...CAMPAIGN_TEXT.caption, color: config.accent },
    ),
  );
  const cards = CHOICES.map((ending, i) => {
    const allowed = config.options.available.includes(ending);
    const y = top + L.tallyHeight + i * (L.cardHeight + L.cardGap) + L.cardHeight / 2;
    const card = new SelectableCard(
      scene,
      0,
      y,
      { width: L.width - L.padding * 2, height: L.cardHeight, accent: config.accent, accentBar: true },
      allowed ? () => config.onChoose(ending) : undefined,
    );
    const text = ENDING_TEXT[ending];
    const title = addHoloText(scene, card.left + 20, -L.cardHeight / 2 + 12, text.title, {
      ...CAMPAIGN_TEXT.heading,
      color: allowed ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textMuted,
    });
    const summary = addHoloText(scene, card.left + 20, -L.cardHeight / 2 + 40, text.summary, {
      ...CAMPAIGN_TEXT.body,
      size: 13,
      wrapWidth: card.right - card.left - 40,
    });
    const chip = addCaptionChip(
      scene,
      card.right - 14,
      -L.cardHeight / 2 + 20,
      allowed ? "AVAILABLE" : requirementOf(ending),
      allowed ? config.accent : HOLO_PALETTE.textMuted,
    );
    card.add([title, summary, chip]);
    card.setName(`ending_card_${ending}`);
    panel.add(card);
    return card;
  });
  return { panel, cards: cards.filter((c) => c.enabled) };
}
