/**
 * CoalitionLeadSwap — the Coalition hub's lead control: the five faction
 * heroes as portrait cards (the current lead highlighted), a line saying
 * which two powers are on the bar, and a tooltip per hero saying what a swap
 * changes. Keyboard: the cards join the hub's focus order (ENTER swaps).
 * Presentation only; the scene applies the swap.
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import type { FocusTarget } from "../menu/MenuFocus";
import { attachHintTooltip } from "../menu/HintTooltip";
import { addPickerText } from "../picker/pickerStyle";
import { HOLO_PALETTE, HOLO_SPACING, factionAccent } from "../theme/HoloTheme";
import { SelectableCard } from "./SelectableCard";
import { HERO_CARD_LAYOUT } from "./HeroCard";
import {
  LEAD_CONTROL_TITLE,
  coalitionLeadOptions,
  type LeadOption,
} from "./coalitionLeadModel";

/** Control layout (screen px): under the hero card, same column. */
export const LEAD_SWAP_LAYOUT = {
  x: HERO_CARD_LAYOUT.x,
  top: HERO_CARD_LAYOUT.top + HERO_CARD_LAYOUT.height + HOLO_SPACING.md,
  width: HERO_CARD_LAYOUT.width,
  height: 184,
  padding: 16,
  cardWidth: 40,
  cardHeight: 60,
  cardGap: 8,
  portrait: 36,
} as const;

/** Opacity of the wash behind the current lead's card. */
const CURRENT_WASH_ALPHA = 0.3;
const FALLBACK_PORTRAIT = "portrait_command";

/** Inputs of the control. */
export interface LeadSwapConfig {
  /** Faction of the hero that leads now. */
  readonly lead: FactionId;
  readonly accent: number;
  readonly onPick: (lead: FactionId) => void;
}

/** Built control and its keyboard-focus targets (one per hero). */
export interface LeadSwapView {
  readonly panel: HoloPanel;
  readonly focusTargets: FocusTarget[];
}

/**
 * @param scene - Owning scene.
 * @param config - Current lead, accent and pick callback.
 * @returns The panel and one focus target per hero.
 */
export function createLeadSwap(
  scene: Phaser.Scene,
  config: LeadSwapConfig,
): LeadSwapView {
  const L = LEAD_SWAP_LAYOUT;
  const panel = createHoloPanel(
    scene,
    L.x + L.width / 2,
    L.top + L.height / 2,
    {
      width: L.width,
      height: L.height,
      accentColor: config.accent,
      title: LEAD_CONTROL_TITLE,
    },
  );
  const options = coalitionLeadOptions(config.lead);
  const rowWidth = options.length * L.cardWidth + (options.length - 1) * L.cardGap;
  const left = -rowWidth / 2;
  const cardY = panel.contentTop + HOLO_SPACING.md + L.cardHeight / 2;
  const focusTargets = options.map((option, index) => {
    const x = left + L.cardWidth / 2 + index * (L.cardWidth + L.cardGap);
    return addLeadCard(scene, panel, option, x, cardY, config);
  });
  addSummary(scene, panel, options, cardY + L.cardHeight / 2 + HOLO_SPACING.md);
  return { panel, focusTargets };
}

function addLeadCard(
  scene: Phaser.Scene,
  panel: HoloPanel,
  option: LeadOption,
  x: number,
  y: number,
  config: LeadSwapConfig,
): FocusTarget {
  const L = LEAD_SWAP_LAYOUT;
  const accent = factionAccent(option.faction);
  const card = new SelectableCard(
    scene,
    x,
    y,
    {
      width: L.cardWidth,
      height: L.cardHeight,
      accent,
      ...(option.current
        ? {
            idleBorder: accent,
            idleBorderAlpha: 1,
            idleFill: { color: accent, alpha: CURRENT_WASH_ALPHA },
          }
        : {}),
    },
    option.current ? undefined : () => config.onPick(option.faction),
  );
  card.setName(`lead_swap_${option.faction}`);
  const key = scene.textures.exists(option.portraitKey)
    ? option.portraitKey
    : FALLBACK_PORTRAIT;
  const portraitY = -L.cardHeight / 2 + HOLO_SPACING.xs + L.portrait / 2;
  const label = addPickerText(
    scene,
    { x: 0, y: L.cardHeight / 2 - HOLO_SPACING.xs },
    option.current ? "LEAD" : "SWAP",
    "micro",
    option.current ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textMuted,
  ).setOrigin(0.5, 1);
  card.add([
    scene.add.image(0, portraitY, key).setDisplaySize(L.portrait, L.portrait),
    label,
  ]);
  attachHintTooltip(scene, card, option.tooltip);
  panel.add(card);
  return {
    setFocused: (focused: boolean) => {
      card.setFocused(focused);
      card.emit("focuschanged", focused);
    },
    activate: () => card.activate(),
    get visible(): boolean {
      return card.active;
    },
  };
}

function addSummary(
  scene: Phaser.Scene,
  panel: HoloPanel,
  options: readonly LeadOption[],
  y: number,
): void {
  const L = LEAD_SWAP_LAYOUT;
  const lead = options.find((option) => option.current);
  if (!lead) return;
  const x = -L.width / 2 + L.padding;
  const width = L.width - L.padding * 2;
  const name = addPickerText(scene, { x, y }, lead.heroName, "name", HOLO_PALETTE.textPrimary);
  const bar = addPickerText(
    scene,
    { x, y: y + name.height + HOLO_SPACING.xs },
    `[V] ${lead.powerNames[0]}  ·  [B] ${lead.powerNames[1]}`,
    "small",
    HOLO_PALETTE.textSecondary,
  );
  bar.setWordWrapWidth(width);
  const hint = addPickerText(
    scene,
    { x, y: bar.y + bar.height + HOLO_SPACING.xs },
    "Pick a hero to lead the next mission.",
    "small",
    HOLO_PALETTE.textMuted,
  );
  hint.setWordWrapWidth(width);
  panel.add([name, bar, hint]);
}
