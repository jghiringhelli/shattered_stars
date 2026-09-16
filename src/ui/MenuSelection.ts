import Phaser from "phaser";
import { pulse, stopPulse } from "./UIJuice";

/** Width of a main-menu button panel in pixels. */
export const MENU_BUTTON_WIDTH = 300;
/** Height of a main-menu button panel in pixels. */
export const MENU_BUTTON_HEIGHT = 50;
/** Corner radius of the main-menu button rounded rect in pixels. */
export const MENU_BUTTON_RADIUS = 8;

const HALF_W = MENU_BUTTON_WIDTH / 2;
const HALF_H = MENU_BUTTON_HEIGHT / 2;

/**
 * Redraw selection state for all main-menu item containers.
 *
 * Each container must have these data keys set via container.setData():
 *   'glow'    — Phaser.GameObjects.Graphics (the border/fill overlay)
 *   'text'    — Phaser.GameObjects.Text (the button label)
 *   'enabled' — boolean
 *
 * When texturesAvailable is true the glow Graphics draws only the selection
 * border stroke; the image supplied by createTexturedPanel() provides the fill.
 * When false, glow also draws the fill rectangle (pure-Graphics fallback mode).
 * The selected item's label breathes with a slow pulse tween instead of
 * sitting at a static 1.05 scale, so the menu never feels dead.
 *
 * @param scene - Active scene (drives the pulse/tween).
 * @param items - All menu item containers in order.
 * @param selectedIndex - Index of the currently selected item.
 * @param texturesAvailable - Whether tex_btn_normal texture is loaded.
 */
export function applyMenuSelection(
  scene: Phaser.Scene,
  items: ReadonlyArray<Phaser.GameObjects.Container>,
  selectedIndex: number,
  texturesAvailable: boolean,
): void {
  items.forEach((item, index) => {
    const glow = item.getData("glow") as Phaser.GameObjects.Graphics;
    const text = item.getData("text") as Phaser.GameObjects.Text;
    const enabled = item.getData("enabled") as boolean;
    const isSelected = index === selectedIndex;

    glow.clear();

    if (!texturesAvailable) {
      const fillColor = isSelected && enabled ? 0x224466 : 0x112233;
      const fillAlpha = isSelected && enabled ? 0.9 : 0.6;
      glow.fillStyle(fillColor, fillAlpha);
      glow.fillRoundedRect(
        -HALF_W,
        -HALF_H,
        MENU_BUTTON_WIDTH,
        MENU_BUTTON_HEIGHT,
        MENU_BUTTON_RADIUS,
      );
    }

    if (isSelected && enabled) {
      glow.lineStyle(2, 0x44aaff, 1);
      glow.strokeRoundedRect(
        -HALF_W,
        -HALF_H,
        MENU_BUTTON_WIDTH,
        MENU_BUTTON_HEIGHT,
        MENU_BUTTON_RADIUS,
      );
      text.setColor("#44ffaa");
      pulse(scene, text, { scale: 1.08, durationMs: 650 });
    } else {
      text.setColor(enabled ? "#ffffff" : "#666666");
      stopPulse(scene, text);
    }
  });
}
