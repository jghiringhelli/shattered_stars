/**
 * duelSetupChrome — what every duel setup screen shares under its header:
 * the flown-points strip (both sides, one sentence about the gap) and the
 * tab bar. Both go into one root container the caller hands to the scene's
 * track(); `pinTree` makes the whole tree screen-fixed, because the duel
 * scenes keep their camera scrolled to the battlefield.
 */

import Phaser from "phaser";
import { drawDetailTabs } from "../../ui/menu/DetailTabs";
import {
  recallTab,
  rememberTab,
  tabsFor,
  type DetailTabId,
} from "../../ui/menu/detailTabsModel";
import { MENU_LAYOUT } from "../../ui/menu/MenuScaffold";
import { addTipZone } from "../../ui/menu/tooltipTargets";
import { addPickerText } from "../../ui/picker/pickerStyle";
import {
  HOLO_PALETTE,
  HOLO_SPACING,
  SIDE_COLORS,
} from "../../ui/theme/HoloTheme";
import type { PointsStrip } from "./duelPointsModel";

/** Vertical layout of a duel setup at 1280x720 (px, 8 px grid). */
export const DUEL_LAYOUT = {
  stripY: 96,
  stripBarY: 120,
  stripBarH: 8,
  tabsY: 136,
  contentTop: 184,
  contentBottom: 624,
  startCentreFromBottom: MENU_LAYOUT.primaryInset,
  startWidth: 208,
  startHeight: 44,
  startFontPx: 22,
} as const;
/** Width reserved on each side of the strip bar for the point numbers (px). */
const STRIP_NUMBER_W = 136;

/** The screen the tabs belong to. */
const SCREEN = "duelSetup";

/** Setup screen x range (px). */
export interface SetupSpan {
  readonly x: number;
  readonly width: number;
}

/** Where a tab body draws. */
export interface BodyArea {
  readonly scene: Phaser.Scene;
  readonly root: Phaser.GameObjects.Container;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly bottom: number;
}

/**
 * @param scene - The setup scene.
 * @param root - The tab's root container.
 * @returns The content region under the tab bar.
 */
export function bodyArea(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
): BodyArea {
  return {
    scene,
    root,
    ...setupSpan(scene),
    y: DUEL_LAYOUT.contentTop,
    bottom: DUEL_LAYOUT.contentBottom,
  };
}

/**
 * @param scene - The setup scene.
 * @returns The content's left edge and width inside the menu margins.
 */
export function setupSpan(scene: Phaser.Scene): SetupSpan {
  return {
    x: MENU_LAYOUT.margin,
    width: scene.scale.width - 2 * MENU_LAYOUT.margin,
  };
}

/**
 * Makes an object and everything inside it screen-fixed (scroll factor 0):
 * Phaser hit-tests each interactive object with its own scroll factor.
 *
 * @param obj - Object to pin (containers recursively).
 */
export function pinTree(obj: Phaser.GameObjects.GameObject): void {
  (obj as unknown as { setScrollFactor?: (x: number) => void }).setScrollFactor?.(0);
  const list = (obj as Phaser.GameObjects.Container).list;
  if (Array.isArray(list)) list.forEach(pinTree);
}

/** @returns The tab the duel setups have open (remembered for the session). */
export function openDuelTab(): DetailTabId {
  return recallTab(SCREEN);
}

/** @param tab - The tab to open. */
export function openDuelTabById(tab: DetailTabId): void {
  rememberTab(SCREEN, tab);
}

/** @param direction - +1 opens the next tab, -1 the previous one. */
export function stepDuelTab(direction: 1 | -1): void {
  const tabs = tabsFor(SCREEN);
  const index = tabs.findIndex((tab) => tab.id === openDuelTab());
  rememberTab(SCREEN, tabs[(index + direction + tabs.length) % tabs.length]!.id);
}

/** What the frame needs. */
export interface DuelFrameSpec {
  readonly strip: PointsStrip;
  readonly tab: DetailTabId;
  readonly accent: number;
  readonly onTab: (tab: DetailTabId) => void;
}

/**
 * Draws the points strip and the tab bar into a fresh root container.
 *
 * @param scene - The setup scene.
 * @param spec - Strip numbers, open tab, accent and callback.
 * @returns The root container the tab body joins.
 */
export function drawDuelFrame(
  scene: Phaser.Scene,
  spec: DuelFrameSpec,
): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);
  drawPointsStrip(scene, root, spec.strip);
  drawDetailTabs(scene, root, {
    ...setupSpan(scene),
    y: DUEL_LAYOUT.tabsY,
    accent: spec.accent,
    tabs: tabsFor(SCREEN),
    active: spec.tab,
    onSelect: spec.onTab,
  });
  return root;
}

function drawPointsStrip(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  strip: PointsStrip,
): void {
  const { x, width } = setupSpan(scene);
  const barX = x + STRIP_NUMBER_W;
  const barW = width - 2 * STRIP_NUMBER_W;
  const barY = DUEL_LAYOUT.stripBarY;
  const split = barW * strip.youShare;
  const bar = scene.add.graphics();
  bar.fillStyle(SIDE_COLORS.player, 1).fillRect(barX, barY, split, DUEL_LAYOUT.stripBarH);
  bar.fillStyle(SIDE_COLORS.enemy, 1).fillRect(
    barX + split,
    barY,
    barW - split,
    DUEL_LAYOUT.stripBarH,
  );
  bar.fillStyle(HOLO_PALETTE.textPrimary, 1).fillRect(
    barX + split - 1,
    barY - HOLO_SPACING.xs,
    2,
    DUEL_LAYOUT.stripBarH + HOLO_SPACING.sm,
  );
  const midY = barY + DUEL_LAYOUT.stripBarH / 2;
  const you = addPickerText(scene, { x, y: midY }, `YOU  ${strip.you} pt`, "numeric", SIDE_COLORS.player).setOrigin(0, 0.5);
  const enemy = addPickerText(scene, { x: x + width, y: midY }, `${strip.enemy} pt  ENEMY`, "numeric", SIDE_COLORS.enemy).setOrigin(1, 0.5);
  const verdictColor =
    strip.verdict === "down" ? HOLO_PALETTE.warning : HOLO_PALETTE.textPrimary;
  const caption = addPickerText(
    scene,
    { x: x + width / 2, y: DUEL_LAYOUT.stripY },
    strip.caption,
    "small",
    verdictColor,
  ).setOrigin(0.5, 0.5);
  root.add([bar, you, enemy, caption]);
  const zoneH = DUEL_LAYOUT.stripBarH + HOLO_SPACING.lg;
  addTipZone(scene, root, { x, y: midY - zoneH / 2, width: STRIP_NUMBER_W, height: zoneH }, "duel.points_you");
  addTipZone(scene, root, { x: x + width - STRIP_NUMBER_W, y: midY - zoneH / 2, width: STRIP_NUMBER_W, height: zoneH }, "duel.points_enemy");
  addTipZone(scene, root, { x: barX, y: DUEL_LAYOUT.stripY - HOLO_SPACING.sm, width: barW, height: zoneH + HOLO_SPACING.xl }, "duel.points_gap");
}
