import Phaser from "phaser";
import { pulse, stopPulse } from "./UIJuice";
import { drawPanelChrome } from "./PanelChrome";

/** Width of a main-menu button panel in pixels. */
export const MENU_BUTTON_WIDTH = 300;
/** Height of a main-menu button panel in pixels. */
export const MENU_BUTTON_HEIGHT = 50;

/**
 * Redraw selection state for all main-menu item containers.
 *
 * Each container must have these data keys set via container.setData():
 *   'chrome'  — Phaser.GameObjects.Graphics (the panel background and frame)
 *   'text'    — Phaser.GameObjects.Text (the button label)
 *   'enabled' — boolean
 *
 * The panel is drawn rather than blitted from a texture: a button has to look
 * right at whatever size the layout gives it, and a stretched bitmap smears
 * its bevels at every size but the one it was authored at.
 *
 * The selected item's label breathes with a slow pulse tween instead of
 * sitting at a static scale, so the menu never feels dead.
 *
 * @param scene - Active scene (drives the pulse/tween).
 * @param items - All menu item containers in order.
 * @param selectedIndex - Index of the currently selected item.
 */
export function applyMenuSelection(
  scene: Phaser.Scene,
  items: ReadonlyArray<Phaser.GameObjects.Container>,
  selectedIndex: number,
): void {
  items.forEach((item, index) => {
    const chrome = item.getData("chrome") as Phaser.GameObjects.Graphics;
    const text = item.getData("text") as Phaser.GameObjects.Text;
    const enabled = item.getData("enabled") as boolean;
    const isSelected = index === selectedIndex && enabled;

    drawPanelChrome(chrome, {
      width: MENU_BUTTON_WIDTH,
      height: MENU_BUTTON_HEIGHT,
      selected: isSelected,
    });

    if (isSelected) {
      text.setColor("#44ffaa");
      pulse(scene, text, { scale: 1.08, durationMs: 650 });
      return;
    }

    text.setColor(enabled ? "#ffffff" : "#666666");
    stopPulse(scene, text);
  });
}
