/**
 * OptionTabsPanel — the panel shared by the hub's Armory and Research tabs:
 * four groups of two options shown as ONE of three data sets at a time
 * (progressive disclosure), chosen with the detail tabs:
 *
 *   OVERVIEW  the options per slot / tier with their state, click to act
 *   EFFECTS   what each option does, one line each
 *   COST      what each option takes, one line each, plus the totals
 *
 * Every row has a tooltip (short on hover, full on hold / focus).
 */

import type Phaser from "phaser";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { drawDetailTabs } from "../menu/DetailTabs";
import type { DetailScreen, DetailTabId } from "../menu/detailTabsModel";
import { tabsFor } from "../menu/detailTabsModel";
import { attachHintTooltip } from "../menu/HintTooltip";
import type { FocusTarget } from "../menu/MenuFocus";
import { addTipZone, contentOf, focusTipTarget } from "../menu/tooltipTargets";
import { addPickerText, MIN_FONT_SIZE } from "../picker/pickerStyle";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import { addOptionRows, toneColor } from "./OptionRows";
import type { OptionCard, OptionGroup, OptionPanelModel } from "./optionPanelTypes";
import { SelectableCard } from "./SelectableCard";

/** Panel layout (screen px, 8 px grid). */
export const OPTION_PANEL_LAYOUT = {
  x: 32,
  top: 104,
  width: 640,
  height: 520,
  padding: 16,
  captionHeight: 16,
  cardHeight: 56,
  cardGap: 16,
  groupGap: 16,
} as const;

/** Inputs of the panel. */
export interface OptionTabsConfig {
  readonly model: OptionPanelModel;
  readonly screen: DetailScreen;
  readonly tab: DetailTabId;
  readonly accent: number;
  /** Fine print under the overview ("Click a mod to install it…"). */
  readonly footer: string;
  readonly showKeyHint: boolean;
  readonly onSelectTab: (tab: DetailTabId) => void;
  readonly onAction: (key: string) => void;
}

/** Built panel plus its keyboard-focus targets. */
export interface OptionTabsView {
  readonly panel: HoloPanel;
  readonly focusTargets: FocusTarget[];
}

/**
 * @param scene - Owning scene.
 * @param config - Model, open tab, accent and callbacks.
 * @returns The panel and its focus targets (tabs first).
 */
export function createOptionTabsPanel(
  scene: Phaser.Scene,
  config: OptionTabsConfig,
): OptionTabsView {
  const L = OPTION_PANEL_LAYOUT;
  const panel = createHoloPanel(scene, L.x + L.width / 2, L.top + L.height / 2, {
    width: L.width,
    height: L.height,
    accentColor: config.accent,
    title: config.model.title,
    titleSize: MIN_FONT_SIZE,
  });
  const left = -L.width / 2 + L.padding;
  const width = L.width - L.padding * 2;
  const tabs = drawDetailTabs(scene, panel, {
    x: left,
    y: panel.contentTop,
    width,
    accent: config.accent,
    tabs: tabsFor(config.screen),
    active: config.tab,
    showKeyHint: config.showKeyHint,
    onSelect: config.onSelectTab,
  });
  const box = { x: left, y: tabs.bottom + L.padding, width };
  const body = drawBody(scene, panel, config, box);
  return { panel, focusTargets: [...tabs.focusTargets, ...body] };
}

type Box = { readonly x: number; readonly y: number; readonly width: number };

function drawBody(
  scene: Phaser.Scene,
  panel: HoloPanel,
  config: OptionTabsConfig,
  box: Box,
): FocusTarget[] {
  if (config.tab === "overview") return drawOverview(scene, panel, config, box);
  const spec = { ...box, accent: config.accent, onAction: config.onAction };
  const rows =
    config.tab === "effects" ? config.model.effects : config.model.costs;
  const list = addOptionRows(scene, panel, rows, spec);
  if (config.tab !== "cost") return list.targets;
  const totals = addOptionRows(scene, panel, config.model.summary, {
    ...spec,
    y: list.bottom + HOLO_SPACING.sm,
  });
  return [...list.targets, ...totals.targets];
}

function drawOverview(
  scene: Phaser.Scene,
  panel: HoloPanel,
  config: OptionTabsConfig,
  box: Box,
): FocusTarget[] {
  const L = OPTION_PANEL_LAYOUT;
  const stride = L.captionHeight + HOLO_SPACING.sm + L.cardHeight + L.groupGap;
  const targets = config.model.groups.flatMap((group, i) =>
    drawGroup(scene, panel, config, group, { ...box, y: box.y + i * stride }),
  );
  panel.add(
    addPickerText(
      scene,
      { x: box.x, y: L.height / 2 - L.padding - L.captionHeight },
      config.footer,
      "small",
      HOLO_PALETTE.textMuted,
    ),
  );
  return targets;
}

function drawGroup(
  scene: Phaser.Scene,
  panel: HoloPanel,
  config: OptionTabsConfig,
  group: OptionGroup,
  box: Box,
): FocusTarget[] {
  const L = OPTION_PANEL_LAYOUT;
  const caption = addPickerText(
    scene,
    { x: box.x, y: box.y },
    group.caption,
    "caption",
    HOLO_PALETTE.textSecondary,
  );
  panel.add(caption);
  addTipZone(
    scene,
    panel,
    { x: box.x, y: box.y, width: caption.width, height: caption.height },
    group.captionTip,
  );
  const cardWidth = (box.width - L.cardGap) / 2;
  const top = box.y + L.captionHeight + HOLO_SPACING.sm;
  return group.cards.map((card, col) =>
    drawCard(scene, panel, config, card, {
      x: box.x + col * (cardWidth + L.cardGap),
      y: top,
      width: cardWidth,
    }),
  );
}

function drawCard(
  scene: Phaser.Scene,
  panel: HoloPanel,
  config: OptionTabsConfig,
  card: OptionCard,
  box: Box,
): FocusTarget {
  const L = OPTION_PANEL_LAYOUT;
  const key = card.actionKey;
  const view = new SelectableCard(
    scene,
    box.x + box.width / 2,
    box.y + L.cardHeight / 2,
    {
      width: box.width,
      height: L.cardHeight,
      accent: config.accent,
      ...(card.mark.startsWith("\u2713")
        ? { idleBorder: HOLO_PALETTE.success }
        : {}),
    },
    key === null ? undefined : () => config.onAction(key),
  );
  const pad = HOLO_SPACING.md;
  const nameY = card.mark ? -L.cardHeight / 2 + pad - 2 : -HOLO_SPACING.sm;
  view.add(
    addPickerText(
      scene,
      { x: view.left + pad, y: nameY },
      card.name,
      "name",
      card.dim ? HOLO_PALETTE.textMuted : HOLO_PALETTE.textPrimary,
    ),
  );
  if (card.mark) {
    view.add(
      addPickerText(
        scene,
        { x: view.left + pad, y: nameY + HOLO_SPACING.xl },
        card.mark,
        "caption",
        toneColor(card.markTone, config.accent),
      ),
    );
  }
  panel.add(view);
  return cardTarget(scene, panel, view, card, box);
}

function cardTarget(
  scene: Phaser.Scene,
  panel: HoloPanel,
  view: SelectableCard,
  card: OptionCard,
  box: Box,
): FocusTarget {
  const L = OPTION_PANEL_LAYOUT;
  if (!view.enabled) {
    const zone = addTipZone(
      scene,
      panel,
      { x: box.x, y: box.y, width: box.width, height: L.cardHeight },
      card.tip,
    );
    return focusTipTarget(zone, () => undefined);
  }
  attachHintTooltip(scene, view, contentOf(card.tip));
  return {
    setFocused: (focused: boolean) => {
      view.setFocused(focused);
      view.emit("focuschanged", focused);
    },
    activate: () => view.activate(),
    get visible(): boolean {
      return view.active;
    },
  };
}
