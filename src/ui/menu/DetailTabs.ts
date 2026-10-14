/**
 * DetailTabs — the tab bar under a pick screen's header (icon + label per
 * tab, key hint on the right). One tab is open at a time; the open tab is
 * remembered per screen (detailTabsModel). Switch with the mouse, Q / E,
 * gamepad LB / RB, or left / right once a tab holds focus (the tabs are
 * MenuFocus targets). Each tab explains itself on hover or focus.
 *
 * The bar is stateless: the owner re-renders it when the open tab changes.
 */

import Phaser from "phaser";
import { drawHoloFrame } from "./holoChrome";
import { attachTermTooltip } from "./HintTooltip";
import type { FocusTarget } from "./MenuFocus";
import { topLeftHitArea } from "./hitArea";
import { createMenuIcon } from "./MenuIcons";
import { focusTipTarget } from "./tooltipTargets";
import {
  TAB_KEY_HINT,
  type DetailTab,
  type DetailTabId,
} from "./detailTabsModel";
import { HOLO_PALETTE, HOLO_RADIUS, HOLO_SPACING } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { holoFont } from "../theme/holoFont";

/** Tab bar height (px) — two steps of the 8 px grid plus a border. */
export const DETAIL_TABS_H = 32;
/** Widest one tab gets (px). */
const TAB_MAX_W = 128;
/** Icon size inside a tab (px). */
const TAB_ICON_SIZE = 14;
/** Label / key-hint font size (px) — nothing under 12 px at 1280x720. */
const TAB_FONT_SIZE = 12;
/** Fill opacity of the open tab. */
const ACTIVE_FILL_ALPHA = 0.24;
/** Standard-layout gamepad bumpers. */
const GAMEPAD_LB = 4;
const GAMEPAD_RB = 5;

/** Where and how to draw the bar. */
export interface DetailTabsSpec {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly accent: number;
  readonly tabs: readonly DetailTab[];
  readonly active: DetailTabId;
  readonly onSelect: (tab: DetailTabId) => void;
  /** Draw the Q / E key hint (default true). */
  readonly showKeyHint?: boolean;
  /** Narrow bars: only the open tab shows its label (default false). */
  readonly compact?: boolean;
}

/** What the bar created. */
export interface DetailTabsView {
  /** y just below the bar. */
  readonly bottom: number;
  /** One focus target per tab, in bar order (activating selects the tab). */
  readonly focusTargets: FocusTarget[];
}

/**
 * Draws the tab bar.
 *
 * @param scene - Owning scene.
 * @param container - Container the bar joins.
 * @param spec - Box, tabs, open tab and callback.
 * @returns Where the bar ends and its focus targets.
 */
export function drawDetailTabs(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  spec: DetailTabsSpec,
): DetailTabsView {
  const gap = HOLO_SPACING.xs;
  const hint =
    spec.showKeyHint === false ? null : addKeyHint(scene, container, spec);
  const end = hint ? hint.x - hint.width - HOLO_SPACING.md : spec.x + spec.width;
  const widths = tabWidths(spec, end - spec.x - gap * (spec.tabs.length - 1));
  let x = spec.x;
  const focusTargets = spec.tabs.map((tab, i) => {
    const box = { x, width: widths[i]!, label: !spec.compact || tab.id === spec.active };
    x += box.width + gap;
    return drawTab(scene, container, spec, tab, box);
  });
  return { bottom: spec.y + DETAIL_TABS_H, focusTargets };
}

/** Width of an icon-only tab (px). */
const ICON_TAB_W = 40;

function tabWidths(spec: DetailTabsSpec, room: number): number[] {
  if (!spec.compact) {
    return spec.tabs.map(() => Math.min(TAB_MAX_W, room / spec.tabs.length));
  }
  const open = Math.min(TAB_MAX_W, room - ICON_TAB_W * (spec.tabs.length - 1));
  return spec.tabs.map((tab) => (tab.id === spec.active ? open : ICON_TAB_W));
}

function addKeyHint(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  spec: DetailTabsSpec,
): Phaser.GameObjects.Text {
  const hint = scene.add
    .text(spec.x + spec.width, spec.y + DETAIL_TABS_H / 2, TAB_KEY_HINT, {
      ...holoFont(TAB_FONT_SIZE, "400"),
      color: toCssColor(HOLO_PALETTE.textMuted),
    })
    .setOrigin(1, 0.5);
  container.add(hint);
  return hint;
}

function drawTab(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  spec: DetailTabsSpec,
  tab: DetailTab,
  box: { readonly x: number; readonly width: number; readonly label: boolean },
): FocusTarget {
  const open = tab.id === spec.active;
  const tabC = scene.add.container(box.x, spec.y);
  const bg = scene.add.graphics();
  const paint = (lit: boolean): void => {
    bg.clear();
    drawHoloFrame(
      bg,
      { x: 0, y: 0, width: box.width, height: DETAIL_TABS_H },
      {
        radius: HOLO_RADIUS.sm,
        accent: open || lit ? spec.accent : HOLO_PALETTE.border,
        fill: open ? spec.accent : HOLO_PALETTE.panelFill,
        fillAlpha: open ? ACTIVE_FILL_ALPHA : 0.4,
      },
    );
  };
  paint(false);
  const color = open ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textSecondary;
  const label = box.label
    ? scene.add
        .text(0, DETAIL_TABS_H / 2, tab.label, {
          ...holoFont(TAB_FONT_SIZE, "600"),
          color: toCssColor(color),
        })
        .setLetterSpacing(1)
        .setOrigin(0, 0.5)
    : null;
  const contentW =
    TAB_ICON_SIZE + (label ? HOLO_SPACING.xs + label.width : 0);
  const startX = (box.width - contentW) / 2;
  const icon = createMenuIcon(
    scene,
    tab.icon,
    { x: startX + TAB_ICON_SIZE / 2, y: DETAIL_TABS_H / 2 },
    TAB_ICON_SIZE,
    color,
  );
  label?.setX(startX + TAB_ICON_SIZE + HOLO_SPACING.xs);
  tabC.add(label ? [bg, icon, label] : [bg, icon]);
  tabC.setSize(box.width, DETAIL_TABS_H).setInteractive(
    topLeftHitArea(box.width, DETAIL_TABS_H),
    Phaser.Geom.Rectangle.Contains,
  );
  if (tabC.input) tabC.input.cursor = "pointer";
  tabC.on("pointerover", () => paint(true));
  tabC.on("pointerout", () => paint(false));
  tabC.on("focuschanged", (focused: boolean) => paint(focused));
  tabC.on("pointerdown", () => spec.onSelect(tab.id));
  attachTermTooltip(scene, tabC, tab.term);
  container.add(tabC);
  return focusTipTarget(tabC, () => spec.onSelect(tab.id));
}

/** Handlers for the tab-switching keys. */
export interface TabKeyBinding {
  /** Called with +1 (E / RB) or -1 (Q / LB). */
  readonly step: (direction: 1 | -1) => void;
  /** Keys are ignored while this returns false (modal open, panel hidden). */
  readonly isActive?: () => boolean;
}

/**
 * Binds Q / E and gamepad LB / RB to tab stepping for the scene's lifetime.
 *
 * @param scene - Owning scene.
 * @param binding - Step handler and activity gate.
 * @returns An unbind function (also run automatically on scene shutdown).
 */
export function bindTabKeys(
  scene: Phaser.Scene,
  binding: TabKeyBinding,
): () => void {
  const run = (direction: 1 | -1): void => {
    if (binding.isActive && !binding.isActive()) return;
    binding.step(direction);
  };
  const prev = (): void => run(-1);
  const next = (): void => run(1);
  const onPad = (_pad: unknown, button: { index: number }): void => {
    if (button.index === GAMEPAD_LB) prev();
    else if (button.index === GAMEPAD_RB) next();
  };
  scene.input.keyboard?.on("keydown-Q", prev);
  scene.input.keyboard?.on("keydown-E", next);
  scene.input.gamepad?.on("down", onPad);
  const unbind = (): void => {
    scene.input.keyboard?.off("keydown-Q", prev);
    scene.input.keyboard?.off("keydown-E", next);
    scene.input.gamepad?.off("down", onPad);
  };
  scene.events.once("shutdown", unbind);
  return unbind;
}
