/**
 * BootLoadingView — holo loading screen shown while BootScene preloads:
 * wide-tracked title, a thin accent gauge and a percentage caption.
 */

import Phaser from "phaser";
import { drawHoloGauge } from "./holoChrome";
import { MENU_CLEAR_COLOR } from "./MenuScaffold";
import { holoFont } from "../theme/holoFont";
import { HOLO_PALETTE, HOLO_TYPE_SCALE } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";

/** Layout relative to the screen centre. */
const LOADING = {
  titleDy: -40,
  titleSize: 30,
  titleSpacing: 12,
  barWidth: 400,
  barHeight: 4,
  barDy: 6,
  captionDy: 30,
} as const;

/** Handle for updating / removing the loading view. */
export interface BootLoadingView {
  /** Update the gauge (0–1). */
  setProgress(value: number): void;
  /** Remove every object. */
  destroy(): void;
}

/**
 * Build the loading view centred on the screen.
 *
 * @param scene - BootScene (during preload).
 * @returns Progress / destroy handle.
 */
export function createBootLoadingView(scene: Phaser.Scene): BootLoadingView {
  const { width, height } = scene.cameras.main;
  const cx = width / 2;
  const cy = height / 2;
  scene.cameras.main.setBackgroundColor(MENU_CLEAR_COLOR);
  const title = scene.add
    .text(cx, cy + LOADING.titleDy, "SHATTERED STARS", {
      ...holoFont(LOADING.titleSize, "300"),
      color: toCssColor(HOLO_PALETTE.textPrimary),
    })
    .setLetterSpacing(LOADING.titleSpacing)
    .setOrigin(0.5);
  const bar = scene.add.graphics();
  const caption = scene.add
    .text(cx, cy + LOADING.captionDy, "", {
      ...holoFont(HOLO_TYPE_SCALE.caption.size, "600"),
      color: toCssColor(HOLO_PALETTE.textSecondary),
    })
    .setLetterSpacing(HOLO_TYPE_SCALE.caption.letterSpacing * 2)
    .setOrigin(0.5);
  const rect = {
    x: cx - LOADING.barWidth / 2,
    y: cy + LOADING.barDy,
    width: LOADING.barWidth,
    height: LOADING.barHeight,
  };
  const setProgress = (value: number): void => {
    bar.clear();
    drawHoloGauge(bar, rect, value, HOLO_PALETTE.accent);
    caption.setText(`LOADING  ${Math.round(value * 100)}%`);
  };
  setProgress(0);
  return {
    setProgress,
    destroy: () => {
      title.destroy();
      bar.destroy();
      caption.destroy();
    },
  };
}
