/**
 * Main-menu layout pieces: title block, the translucent panel behind the
 * rows with group captions and dividers, and the row factory.
 */

import Phaser from "phaser";
import { createHoloPanel } from "../hud/HoloPanel";
import { MENU_BUTTON_HEIGHT, MENU_BUTTON_WIDTH } from "../MenuSelection";
import {
  MAIN_MENU_GROUP_CAPTIONS,
  type MainMenuEntry,
} from "./mainMenuEntries";
import { holoFont } from "../theme/holoFont";
import {
  HOLO_ALPHA,
  HOLO_PALETTE,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
} from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";

/** Main-menu grid (1280×720). Row pitch/start are mirrored in e2e helpers. */
export const MAIN_MENU_LAYOUT = {
  margin: HOLO_SPACING.xxl,
  scrimAlpha: 0.4,
  titleY: 92,
  titleStartY: 80,
  titleSize: 54,
  titleSpacing: 18,
  taglineY: 146,
  rowStartY: 220,
  rowPitch: 40,
  panelPadding: 14,
  captionGap: 16,
  briefingX: 1010,
  briefingY: 281,
  labelInset: 48,
  labelSize: 16,
  labelSpacing: 3,
  footerColor: {
    ...holoFont(HOLO_TYPE_SCALE.caption.size, "600"),
    color: toCssColor(HOLO_PALETTE.textMuted),
  },
  linkHoverColor: toCssColor(HOLO_PALETTE.accent),
} as const;

/** Soft glow behind the title glyphs. */
const TITLE_GLOW_BLUR = 18;

/**
 * Centre y of a row.
 *
 * @param index - Row index.
 * @returns Scene y.
 */
export function mainMenuRowY(index: number): number {
  return MAIN_MENU_LAYOUT.rowStartY + index * MAIN_MENU_LAYOUT.rowPitch;
}

/**
 * Title and tagline. The title starts slightly high for its entrance tween.
 *
 * @param scene - Main menu scene.
 * @returns The title text (tweened by the scene).
 */
export function createMainMenuTitle(
  scene: Phaser.Scene,
): Phaser.GameObjects.Text {
  const centerX = scene.scale.width / 2;
  scene.add
    .text(centerX, MAIN_MENU_LAYOUT.taglineY, "TACTICAL STARSHIP COMBAT", {
      ...holoFont(HOLO_TYPE_SCALE.caption.size + 1, "600"),
      color: toCssColor(HOLO_PALETTE.accent),
    })
    .setLetterSpacing(6)
    .setOrigin(0.5);
  return scene.add
    .text(centerX, MAIN_MENU_LAYOUT.titleStartY, "SHATTERED STARS", {
      ...holoFont(MAIN_MENU_LAYOUT.titleSize, "300"),
      color: toCssColor(HOLO_PALETTE.textPrimary),
    })
    .setLetterSpacing(MAIN_MENU_LAYOUT.titleSpacing)
    .setShadow(
      0,
      0,
      toCssColor(HOLO_PALETTE.accent),
      TITLE_GLOW_BLUR,
      false,
      true,
    )
    .setOrigin(0.5);
}

/**
 * Panel behind the rows, group captions to its left and dividers between
 * groups.
 *
 * @param scene - Main menu scene.
 * @param entries - Menu entries in display order.
 */
export function addMainMenuChrome(
  scene: Phaser.Scene,
  entries: ReadonlyArray<MainMenuEntry>,
): void {
  const centerX = scene.scale.width / 2;
  const { panelPadding, rowPitch } = MAIN_MENU_LAYOUT;
  const top = mainMenuRowY(0) - MENU_BUTTON_HEIGHT / 2 - panelPadding;
  const bottom =
    mainMenuRowY(entries.length - 1) + MENU_BUTTON_HEIGHT / 2 + panelPadding;
  const width = MENU_BUTTON_WIDTH + panelPadding * 2;
  createHoloPanel(scene, centerX, (top + bottom) / 2, {
    width,
    height: bottom - top,
  });
  const dividers = scene.add.graphics();
  const captionX = centerX - width / 2 - MAIN_MENU_LAYOUT.captionGap;
  entries.forEach((entry, index) => {
    if (index > 0 && entries[index - 1]?.group === entry.group) return;
    const y = mainMenuRowY(index);
    scene.add
      .text(captionX, y, MAIN_MENU_GROUP_CAPTIONS[entry.group], {
        ...holoFont(HOLO_TYPE_SCALE.caption.size, "600"),
        color: toCssColor(HOLO_PALETTE.textSecondary),
      })
      .setLetterSpacing(HOLO_TYPE_SCALE.caption.letterSpacing * 2)
      .setOrigin(1, 0.5);
    if (index === 0) return;
    dividers.lineStyle(1, HOLO_PALETTE.border, HOLO_ALPHA.structure * 2);
    const lineY = y - rowPitch / 2;
    dividers.lineBetween(
      centerX - MENU_BUTTON_WIDTH / 2,
      lineY,
      centerX + MENU_BUTTON_WIDTH / 2,
      lineY,
    );
  });
}

/**
 * One menu row: chrome + glyph + left-aligned label. Selection styling is
 * applied by applyMenuSelection (data keys chrome/text/icon/iconName).
 *
 * @param scene - Main menu scene.
 * @param entry - The entry.
 * @param index - Row index.
 * @returns The row container (not yet interactive).
 */
export function createMainMenuRow(
  scene: Phaser.Scene,
  entry: MainMenuEntry,
  index: number,
): Phaser.GameObjects.Container {
  const container = scene.add.container(
    scene.scale.width / 2,
    mainMenuRowY(index),
  );
  const chrome = scene.add.graphics();
  const icon = scene.add.graphics();
  const text = scene.add
    .text(
      -MENU_BUTTON_WIDTH / 2 + MAIN_MENU_LAYOUT.labelInset,
      0,
      entry.label,
      holoFont(MAIN_MENU_LAYOUT.labelSize, "600"),
    )
    .setLetterSpacing(MAIN_MENU_LAYOUT.labelSpacing)
    .setOrigin(0, 0.5);
  container.add([chrome, icon, text]);
  container.setData("chrome", chrome);
  container.setData("text", text);
  container.setData("icon", icon);
  container.setData("iconName", entry.icon);
  container.setData("enabled", true);
  return container;
}
