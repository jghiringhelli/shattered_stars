/**
 * hudPanelParts — shared building blocks of the Skirmish HUD panels: a
 * HoloPanel pinned into the zoom-compensated HUD root, its screen rect and a
 * change-only text setter.
 */

import Phaser from "phaser";
import { HoloPanel } from "../../ui/hud/HoloPanel";
import type { ScreenRect } from "../../ui/hud/screenRect";
import { HOLO_SPACING } from "../../ui/theme/HoloTheme";

/** Gap between a panel and the screen edge. */
export const PANEL_MARGIN = HOLO_SPACING.sm;
/** Header strip height of a titled HoloPanel. */
export const HEADER_HEIGHT = 28;

export function pinnedPanel(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  width: number,
  height: number,
  title?: string,
): HoloPanel {
  const panel = new HoloPanel(scene, 0, 0, {
    width,
    height,
    ...(title === undefined ? {} : { title }),
  });
  panel.setScrollFactor(0, 0, true);
  parent.add(panel);
  return panel;
}

export function panelRect(
  panel: HoloPanel,
  width: number,
  height: number,
): ScreenRect {
  return { x: panel.x - width / 2, y: panel.y - height / 2, width, height };
}

export function setText(text: Phaser.GameObjects.Text, value: string): void {
  if (text.text !== value) text.setText(value);
}
