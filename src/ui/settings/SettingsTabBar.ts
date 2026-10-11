/**
 * SettingsTabBar — the row of tab buttons across the top of Settings. The
 * active tab uses the primary variant; number keys 1–6 select tabs (wired
 * by the scene).
 */

import type Phaser from "phaser";
import { createHoverButton } from "../ButtonFactory";
import type { HoloPressButton } from "../menu/HoloPressButton";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { SETTINGS_TABS, type SettingsTabId } from "./settingsTabContext";

/** Tab bar geometry. */
export const TAB_BAR = {
  y: 112,
  width: 168,
  height: 34,
  gap: 8,
  font: "600 13px",
} as const;

/**
 * Draw the tab bar.
 *
 * @param scene - Settings scene.
 * @param active - The open tab.
 * @param onSelect - Called with the chosen tab.
 * @returns The tab buttons in order.
 */
export function createSettingsTabBar(
  scene: Phaser.Scene,
  active: SettingsTabId,
  onSelect: (tab: SettingsTabId) => void,
): HoloPressButton[] {
  const total =
    SETTINGS_TABS.length * TAB_BAR.width +
    (SETTINGS_TABS.length - 1) * TAB_BAR.gap;
  const left = (scene.scale.width - total) / 2 + TAB_BAR.width / 2;
  return SETTINGS_TABS.map((tab, i) =>
    createHoverButton(
      scene,
      left + i * (TAB_BAR.width + TAB_BAR.gap),
      TAB_BAR.y,
      {
        width: TAB_BAR.width,
        height: TAB_BAR.height,
        label: `${i + 1}  ${tab.label.toUpperCase()}`,
        color: HOLO_PALETTE.panelFill,
        variant: tab.id === active ? "primary" : "secondary",
        font: TAB_BAR.font,
        icon: tab.icon,
      },
      () => {
        if (tab.id !== active) onSelect(tab.id);
      },
    ),
  );
}
