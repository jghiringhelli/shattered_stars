/**
 * TrainingBanner — the persistent bar across the top of Flight School:
 * "FLIGHT SCHOOL · TRAINING", "no score, no penalty" and the lesson counter.
 * Shown during every lesson and the final exam so it is never mistaken for
 * a real battle.
 */

import Phaser from "phaser";
import { holoFont } from "../../ui/theme/holoFont";
import { HOLO_PALETTE, HOLO_SPACING } from "../../ui/theme/HoloTheme";
import { toCssColor } from "../../ui/theme/colorMath";

/** Banner height (px); the lesson card sits below it. */
export const BANNER_HEIGHT = 28;
const EDGE_HEIGHT = 2;
const FILL_ALPHA = 0.92;
const TITLE = { text: "FLIGHT SCHOOL · TRAINING", size: 14 } as const;
const SIDE = { text: "NO SCORE · NO PENALTY", size: 12 } as const;
/** Depth above the battle HUD. */
const UI_DEPTH = 1100;

/** The top banner. */
export class TrainingBanner {
  private readonly counter: Phaser.GameObjects.Text;

  /** @param scene - Flight School scene. */
  constructor(scene: Phaser.Scene) {
    const { width } = scene.scale;
    const bar = scene.add.graphics();
    bar.fillStyle(HOLO_PALETTE.panelFill, FILL_ALPHA);
    bar.fillRect(0, 0, width, BANNER_HEIGHT);
    bar.fillStyle(HOLO_PALETTE.warning, 1);
    bar.fillRect(0, BANNER_HEIGHT - EDGE_HEIGHT, width, EDGE_HEIGHT);
    const line = (
      x: number,
      originX: number,
      text: string,
      size: number,
      color: number,
    ): Phaser.GameObjects.Text =>
      scene.add
        .text(x, (BANNER_HEIGHT - EDGE_HEIGHT) / 2, text, {
          ...holoFont(size, "600"),
          color: toCssColor(color),
        })
        .setOrigin(originX, 0.5);
    this.counter = line(
      width - HOLO_SPACING.lg,
      1,
      "",
      SIDE.size,
      HOLO_PALETTE.textPrimary,
    );
    for (const obj of [
      bar,
      line(width / 2, 0.5, TITLE.text, TITLE.size, HOLO_PALETTE.warning),
      line(
        HOLO_SPACING.lg,
        0,
        SIDE.text,
        SIDE.size,
        HOLO_PALETTE.textSecondary,
      ),
      this.counter,
    ])
      obj.setScrollFactor(0).setDepth(UI_DEPTH);
  }

  /**
   * @param index - Lesson index (0-based).
   * @param total - Number of lessons.
   */
  setLesson(index: number, total: number): void {
    this.counter.setText(`LESSON ${index + 1} / ${total}`);
  }

  /** The course is finished (the banner stays: this is still training). */
  setComplete(): void {
    this.counter.setText("COURSE COMPLETE");
  }
}
