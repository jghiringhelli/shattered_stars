import Phaser from "phaser";
import { drawHoloFrame } from "./menu/holoChrome";
import { drawMenuIcon, type MenuIconName } from "./menu/MenuIcons";
import { HOLO_BORDER, HOLO_PALETTE, HOLO_RADIUS } from "./theme/HoloTheme";
import { toCssColor } from "./theme/colorMath";

/** Width of a main-menu row in pixels. */
export const MENU_BUTTON_WIDTH = 300;
/** Height of a main-menu row in pixels (rows sit on a 40-px pitch). */
export const MENU_BUTTON_HEIGHT = 34;

/** Glyph size inside a menu row. */
export const MENU_ICON_SIZE = 16;
/** Glyph centre, relative to the row centre. */
export const MENU_ICON_X = -MENU_BUTTON_WIDTH / 2 + 26;
/** Width of the bright bar marking the selected row. */
const SELECTION_BAR_WIDTH = 3;
/** Vertical inset of the selection bar. */
const SELECTION_BAR_INSET = 7;
/** Accent fill opacity of the selected row. */
const SELECTED_FILL_ALPHA = 0.18;
/** Fill opacity of idle rows (barely there — the panel carries the look). */
const IDLE_FILL_ALPHA = 0.22;

/**
 * Redraw selection state for all main-menu item containers.
 *
 * Each container must have these data keys set via container.setData():
 *   'chrome'  — Phaser.GameObjects.Graphics (row background and frame)
 *   'text'    — Phaser.GameObjects.Text (the label)
 *   'enabled' — boolean
 * and may have:
 *   'icon'     — Phaser.GameObjects.Graphics the glyph is drawn into
 *   'iconName' — MenuIconName of that glyph
 *
 * The selected row gets an accent-tinted fill, accent border and a bright
 * left bar (holo look); idle rows stay quiet so the hierarchy reads at a
 * glance.
 *
 * @param scene - Active scene (unused; kept for API compatibility).
 * @param items - All menu item containers in order.
 * @param selectedIndex - Index of the currently selected item.
 */
export function applyMenuSelection(
  scene: Phaser.Scene,
  items: ReadonlyArray<Phaser.GameObjects.Container>,
  selectedIndex: number,
): void {
  void scene;
  items.forEach((item, index) => {
    const enabled = item.getData("enabled") as boolean;
    const isSelected = index === selectedIndex && enabled;
    drawRowChrome(
      item.getData("chrome") as Phaser.GameObjects.Graphics,
      isSelected,
    );
    const textColor = isSelected
      ? HOLO_PALETTE.textPrimary
      : enabled
        ? HOLO_PALETTE.textSecondary
        : HOLO_PALETTE.textMuted;
    (item.getData("text") as Phaser.GameObjects.Text).setColor(
      toCssColor(textColor),
    );
    const icon = item.getData("icon") as
      Phaser.GameObjects.Graphics | undefined;
    const iconName = item.getData("iconName") as MenuIconName | undefined;
    if (!icon || !iconName) return;
    icon.clear();
    drawMenuIcon(
      icon,
      iconName,
      { x: MENU_ICON_X, y: 0 },
      MENU_ICON_SIZE,
      isSelected ? HOLO_PALETTE.accent : textColor,
    );
  });
}

/**
 * Draw one row's background centred on the origin.
 *
 * @param chrome - Row graphics (cleared first).
 * @param selected - Whether the row is selected.
 */
function drawRowChrome(
  chrome: Phaser.GameObjects.Graphics,
  selected: boolean,
): void {
  const rect = {
    x: -MENU_BUTTON_WIDTH / 2,
    y: -MENU_BUTTON_HEIGHT / 2,
    width: MENU_BUTTON_WIDTH,
    height: MENU_BUTTON_HEIGHT,
  };
  chrome.clear();
  if (!selected) {
    drawHoloFrame(chrome, rect, {
      fill: HOLO_PALETTE.panelFillRaised,
      fillAlpha: IDLE_FILL_ALPHA,
      borderAlpha: 0,
      radius: HOLO_RADIUS.sm,
    });
    return;
  }
  drawHoloFrame(chrome, rect, {
    fill: HOLO_PALETTE.accent,
    fillAlpha: SELECTED_FILL_ALPHA,
    accent: HOLO_PALETTE.accent,
    borderWidth: HOLO_BORDER.regular,
    borderAlpha: 1,
    radius: HOLO_RADIUS.sm,
  });
  chrome.fillStyle(HOLO_PALETTE.accent, 1);
  chrome.fillRect(
    rect.x,
    rect.y + SELECTION_BAR_INSET,
    SELECTION_BAR_WIDTH,
    rect.height - SELECTION_BAR_INSET * 2,
  );
}
