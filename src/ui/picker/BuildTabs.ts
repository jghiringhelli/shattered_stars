/**
 * BuildTabs — the tab strip under the payload row of the ship picker's
 * detail panel: BUILD (pilot, ability, slots, cards), HOW TO FLY, PROS &
 * CONS and COST. Each tab explains itself on hover.
 */

import Phaser from "phaser";
import type { TermId } from "../../data/tooltips";
import { drawHoloFrame } from "../menu/holoChrome";
import { attachTermTooltip } from "../menu/HintTooltip";
import { HOLO_PALETTE, HOLO_RADIUS, HOLO_SPACING } from "../theme/HoloTheme";
import { addPickerText } from "./pickerStyle";

/** The detail panel's tabs. */
export type BuildTab = "build" | "guide" | "pros" | "cost";

/** Tab strip height (px). */
export const BUILD_TABS_H = 22;
/** Widest a tab gets (px). */
const TAB_MAX_W = 130;

const TABS: ReadonlyArray<{
  readonly id: BuildTab;
  readonly label: string;
  readonly term: TermId;
}> = [
  { id: "build", label: "BUILD", term: "ui.tab_build" },
  { id: "guide", label: "HOW TO FLY", term: "ui.tab_guide" },
  { id: "pros", label: "PROS & CONS", term: "ui.tab_pros_cons" },
  { id: "cost", label: "COST", term: "ui.tab_cost" },
];

/** Where and how to draw the strip. */
export interface BuildTabsSpec {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly accent: number;
  readonly active: BuildTab;
  readonly onSelect: (tab: BuildTab) => void;
}

/**
 * Draws the tab strip.
 *
 * @param scene - Owning scene.
 * @param container - Target container.
 * @param spec - Box, accent, active tab and callback.
 * @returns y just below the strip.
 */
export function drawBuildTabs(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  spec: BuildTabsSpec,
): number {
  const gap = HOLO_SPACING.xs;
  const tabW = Math.min(TAB_MAX_W, (spec.width - gap * (TABS.length - 1)) / TABS.length);
  TABS.forEach((tab, i) => {
    const active = tab.id === spec.active;
    const tabC = scene.add.container(spec.x + i * (tabW + gap), spec.y);
    const bg = scene.add.graphics();
    const paint = (hover: boolean): void => {
      bg.clear();
      drawHoloFrame(
        bg,
        { x: 0, y: 0, width: tabW, height: BUILD_TABS_H },
        {
          radius: HOLO_RADIUS.sm,
          accent: active || hover ? spec.accent : HOLO_PALETTE.border,
          fill: active ? spec.accent : HOLO_PALETTE.panelFill,
          fillAlpha: active ? 0.24 : 0.5,
        },
      );
    };
    paint(false);
    const label = addPickerText(
      scene,
      { x: tabW / 2, y: BUILD_TABS_H / 2 },
      tab.label,
      "micro",
      active ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textSecondary,
    ).setOrigin(0.5);
    tabC.add([bg, label]);
    tabC.setSize(tabW, BUILD_TABS_H).setInteractive(
      new Phaser.Geom.Rectangle(0, 0, tabW, BUILD_TABS_H),
      Phaser.Geom.Rectangle.Contains,
    );
    if (tabC.input) tabC.input.cursor = "pointer";
    tabC.on("pointerover", () => paint(true));
    tabC.on("pointerout", () => paint(false));
    tabC.on("pointerdown", () => spec.onSelect(tab.id));
    attachTermTooltip(scene, tabC, tab.term);
    container.add(tabC);
  });
  return spec.y + BUILD_TABS_H;
}
