/**
 * DebriefEvolutionView — the "choose your destiny" step of the debrief:
 * prompt plus two option cards (HoloPanels) with stat bonuses, granted
 * ability, flavour text and a SELECT button each.
 */

import type Phaser from "phaser";
import type {
  EvolutionChoiceData,
  EvolutionOption,
} from "../../data/CampaignData";
import { createHoverButton } from "../ButtonFactory";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { abilityDisplayName } from "../idLabels";
import type { HoloPressButton } from "../menu/HoloPressButton";

import { HOLO_ALPHA, HOLO_BORDER, HOLO_PALETTE } from "../theme/HoloTheme";
import { CAMPAIGN_TEXT, addHoloText } from "./campaignUi";

/** Evolution screen layout (screen coordinates). */
const EVOLUTION_LAYOUT = {
  centerX: 640,
  titleY: 116,
  promptY: 140,
  promptWidth: 900,
  cardTop: 200,
  cardWidth: 560,
  cardHeight: 360,
  cardGap: 32,
  warningY: 592,
  padding: 24,
  labelSize: 20,
  sectionGap: 16,
  buttonWidth: 200,
  buttonHeight: 40,
  buttonInset: 36,
  flavorSize: 13,
  ruleHighlight: 64,
} as const;

/** Inputs for {@link createEvolutionView}. */
export interface EvolutionViewConfig {
  readonly choice: EvolutionChoiceData;
  readonly accent: number;
  readonly onChoose: (option: EvolutionOption) => void;
}

/** Built evolution view. */
export interface EvolutionView {
  readonly objects: Phaser.GameObjects.GameObject[];
  readonly buttons: HoloPressButton[];
}

/**
 * Build the evolution choice view.
 *
 * @param scene - Owning scene.
 * @param config - Choice data, accent and selection callback.
 * @returns Created objects and the two SELECT buttons.
 */
export function createEvolutionView(
  scene: Phaser.Scene,
  config: EvolutionViewConfig,
): EvolutionView {
  const L = EVOLUTION_LAYOUT;
  const title = addHoloText(scene, L.centerX, L.titleY, "CHOOSE YOUR DESTINY", {
    ...CAMPAIGN_TEXT.heading,
    letterSpacing: 4,
    color: config.accent,
  }).setOrigin(0.5);
  const prompt = addHoloText(
    scene,
    L.centerX,
    L.promptY,
    config.choice.promptText,
    { ...CAMPAIGN_TEXT.body, wrapWidth: L.promptWidth, align: "center" },
  ).setOrigin(0.5, 0);
  const warning = addHoloText(
    scene,
    L.centerX,
    L.warningY,
    "⚠ THIS CHOICE IS PERMANENT",
    { ...CAMPAIGN_TEXT.caption, color: HOLO_PALETTE.danger },
  ).setOrigin(0.5);
  const offset = (L.cardWidth + L.cardGap) / 2;
  const cards = [config.choice.optionA, config.choice.optionB].map(
    (option, i) =>
      createOptionCard(
        scene,
        option,
        L.centerX + (i === 0 ? -offset : offset),
        config,
      ),
  );
  return {
    objects: [title, prompt, warning, ...cards.map((c) => c.panel)],
    buttons: cards.map((c) => c.button),
  };
}

function createOptionCard(
  scene: Phaser.Scene,
  option: EvolutionOption,
  centerX: number,
  config: EvolutionViewConfig,
): { panel: HoloPanel; button: HoloPressButton } {
  const L = EVOLUTION_LAYOUT;
  const panel = createHoloPanel(scene, centerX, L.cardTop + L.cardHeight / 2, {
    width: L.cardWidth,
    height: L.cardHeight,
    accentColor: config.accent,
  });
  addCardBody(scene, panel, option, config.accent);
  const button = createHoverButton(
    scene,
    0,
    L.cardHeight / 2 - L.buttonInset,
    {
      width: L.buttonWidth,
      height: L.buttonHeight,
      color: config.accent,
      variant: "primary",
      label: "SELECT",
      font: "600 15px",
    },
    () => config.onChoose(option),
  );
  panel.add(button);
  return { panel, button };
}

function bonusLines(option: EvolutionOption): string {
  const lines = Object.entries(option.statBonuses)
    .filter(([, v]) => v !== undefined && v !== 0)
    .map(([k, v]) => `+${v} ${k.toUpperCase()}`);
  return lines.length > 0 ? lines.join("   ") : "None";
}

function addCardBody(
  scene: Phaser.Scene,
  panel: HoloPanel,
  option: EvolutionOption,
  accent: number,
): void {
  const L = EVOLUTION_LAYOUT;
  const left = -L.cardWidth / 2 + L.padding;
  const wrapWidth = L.cardWidth - L.padding * 2;
  let y = -L.cardHeight / 2 + L.padding;
  const place = (text: Phaser.GameObjects.Text, gapAfter: number): void => {
    text.setPosition(left, y);
    panel.add(text);
    y += text.height + gapAfter;
  };
  place(
    addHoloText(scene, 0, 0, option.label, {
      size: L.labelSize,
      weight: "600",
      wrapWidth,
    }),
    L.sectionGap / 2,
  );
  const rule = scene.add.graphics();
  rule.lineStyle(HOLO_BORDER.hairline, accent, HOLO_ALPHA.structure);
  rule.lineBetween(left, y, left + wrapWidth, y);
  rule.lineStyle(HOLO_BORDER.regular, accent, 1);
  rule.lineBetween(left, y, left + L.ruleHighlight, y);
  panel.add(rule);
  y += L.sectionGap;
  place(
    addHoloText(scene, 0, 0, option.description, {
      ...CAMPAIGN_TEXT.body,
      wrapWidth,
      lineSpacing: 4,
    }),
    L.sectionGap,
  );
  for (const [caption, value, tint] of [
    ["STAT BONUSES", bonusLines(option), HOLO_PALETTE.success],
    [
      "GRANTS ABILITY",
      abilityDisplayName(option.grantAbilityId).toUpperCase(),
      HOLO_PALETTE.warning,
    ],
  ] as const) {
    place(
      addHoloText(scene, 0, 0, caption, {
        ...CAMPAIGN_TEXT.caption,
        color: tint,
      }),
      4,
    );
    place(
      addHoloText(scene, 0, 0, value, { ...CAMPAIGN_TEXT.numeric, size: 15 }),
      L.sectionGap,
    );
  }
  place(
    addHoloText(scene, 0, 0, option.flavorText, {
      size: L.flavorSize,
      weight: "italic",
      color: HOLO_PALETTE.textMuted,
      wrapWidth,
    }),
    0,
  );
}
