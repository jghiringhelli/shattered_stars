/**
 * LessonPanel — Flight School's instruction UI (screen space): the lesson
 * card (number, title, prompt naming the bound keys), the 500 ms cycle
 * beat bar with the current and queued maneuver, a completion toast and
 * the course-complete card.
 */

import Phaser from "phaser";
import { createHoloPanel, type HoloPanel } from "../../ui/hud/HoloPanel";
import { holoFont } from "../../ui/theme/holoFont";
import { HOLO_PALETTE, HOLO_SPACING } from "../../ui/theme/HoloTheme";
import { toCssColor } from "../../ui/theme/colorMath";

const CARD = {
  y: 78,
  width: 780,
  height: 118,
  promptSize: 15,
  titleSize: 12,
  hintSize: 11,
} as const;
/** Corner hint: the course's skip / leave keys (same format as menu footers). */
const KEY_HINT = "N  SKIP LESSON      ESC / B  LEAVE";
const BEAT = {
  y: 152,
  width: 420,
  height: 6,
  labelSize: 12,
  labelGap: 14,
} as const;
const TOAST = { y: 228, size: 20, holdMs: 900, fadeMs: 300 } as const;
const DONE = { width: 560, height: 200, size: 15 } as const;
/** Depth above the battle HUD. */
const UI_DEPTH = 1100;

/** Flight School instruction overlay. */
export class LessonPanel {
  private readonly card: HoloPanel;
  private readonly title: Phaser.GameObjects.Text;
  private readonly prompt: Phaser.GameObjects.Text;
  private readonly beat: Phaser.GameObjects.Graphics;
  private readonly beatLabel: Phaser.GameObjects.Text;
  private readonly toast: Phaser.GameObjects.Text;

  /** @param scene - Flight School scene. */
  constructor(private readonly scene: Phaser.Scene) {
    const cx = scene.scale.width / 2;
    this.card = createHoloPanel(scene, cx, CARD.y, {
      width: CARD.width,
      height: CARD.height,
      title: "Flight School",
    });
    const left = -CARD.width / 2 + HOLO_SPACING.lg;
    this.title = scene.add
      .text(
        CARD.width / 2 - HOLO_SPACING.lg,
        -CARD.height / 2 + HOLO_SPACING.sm,
        "",
        {
          ...holoFont(CARD.titleSize, "600"),
          color: toCssColor(HOLO_PALETTE.accent),
        },
      )
      .setOrigin(1, 0);
    this.prompt = scene.add
      .text(left, this.card.contentTop + HOLO_SPACING.xs, "", {
        ...holoFont(CARD.promptSize, "400"),
        color: toCssColor(HOLO_PALETTE.textPrimary),
        wordWrap: { width: CARD.width - HOLO_SPACING.lg * 2 },
        lineSpacing: HOLO_SPACING.xxs,
      })
      .setOrigin(0, 0);
    this.card.add([this.title, this.prompt, this.keyHint()]);
    this.beat = scene.add.graphics();
    this.beatLabel = scene.add
      .text(cx, BEAT.y + BEAT.labelGap, "", {
        ...holoFont(BEAT.labelSize, "600"),
        color: toCssColor(HOLO_PALETTE.textSecondary),
      })
      .setOrigin(0.5, 0);
    this.toast = scene.add
      .text(cx, TOAST.y, "", {
        ...holoFont(TOAST.size, "600"),
        color: toCssColor(HOLO_PALETTE.success),
      })
      .setOrigin(0.5)
      .setAlpha(0);
    for (const obj of [this.card, this.beat, this.beatLabel, this.toast])
      obj.setScrollFactor(0).setDepth(UI_DEPTH);
    this.card.setScrollFactor(0, 0, true);
  }

  /** @returns The card's corner hint: how to skip a lesson or leave. */
  private keyHint(): Phaser.GameObjects.Text {
    return this.scene.add
      .text(
        CARD.width / 2 - HOLO_SPACING.lg,
        CARD.height / 2 - HOLO_SPACING.sm,
        KEY_HINT,
        {
          ...holoFont(CARD.hintSize, "600"),
          color: toCssColor(HOLO_PALETTE.textMuted),
        },
      )
      .setOrigin(1, 1);
  }

  /**
   * @param index - Lesson index (0-based).
   * @param total - Number of lessons.
   * @param title - Lesson title.
   * @param prompt - Instruction text.
   */
  showLesson(
    index: number,
    total: number,
    title: string,
    prompt: string,
  ): void {
    this.title.setText(`LESSON ${index + 1}/${total} · ${title.toUpperCase()}`);
    this.prompt.setText(prompt);
  }

  /**
   * Draw the cycle beat: progress through the current 500 ms maneuver and
   * what is queued for the next one.
   *
   * @param progress - 0..1 through the current cycle.
   * @param now - Maneuver flying now.
   * @param next - Maneuver queued (null = straight).
   */
  setBeat(progress: number, now: string | null, next: string | null): void {
    const x = this.scene.scale.width / 2 - BEAT.width / 2;
    const g = this.beat;
    g.clear();
    g.fillStyle(HOLO_PALETTE.track, HOLO_PALETTE.trackAlpha);
    g.fillRect(x, BEAT.y, BEAT.width, BEAT.height);
    g.fillStyle(HOLO_PALETTE.accent, 1);
    g.fillRect(
      x,
      BEAT.y,
      BEAT.width * Phaser.Math.Clamp(progress, 0, 1),
      BEAT.height,
    );
    const label = (m: string | null): string =>
      (m ?? "straight").replace("_", " ").toUpperCase();
    this.beatLabel.setText(
      `500 ms CYCLE   NOW: ${label(now)}   ▸   NEXT: ${label(next)}`,
    );
  }

  /**
   * Flash a short confirmation.
   *
   * @param text - Toast text.
   */
  flashToast(text: string): void {
    this.scene.tweens.killTweensOf(this.toast);
    this.toast.setText(text).setAlpha(1);
    this.scene.tweens.add({
      targets: this.toast,
      alpha: 0,
      delay: TOAST.holdMs,
      duration: TOAST.fadeMs,
    });
  }

  /**
   * Replace the lesson card with the course-complete card.
   *
   * @param message - Completion text.
   */
  showComplete(message: string): void {
    this.card.setVisible(false);
    this.beat.setVisible(false);
    this.beatLabel.setVisible(false);
    const { width, height } = this.scene.scale;
    const panel = createHoloPanel(this.scene, width / 2, height / 2, {
      width: DONE.width,
      height: DONE.height,
      title: "Course complete",
      accentColor: HOLO_PALETTE.success,
    });
    const text = this.scene.add
      .text(0, panel.contentTop + DONE.height / 4, message, {
        ...holoFont(DONE.size, "400"),
        color: toCssColor(HOLO_PALETTE.textPrimary),
        align: "center",
        wordWrap: { width: DONE.width - HOLO_SPACING.xl * 2 },
      })
      .setOrigin(0.5, 0);
    panel.add(text);
    panel.setScrollFactor(0, 0, true).setDepth(UI_DEPTH);
  }
}
