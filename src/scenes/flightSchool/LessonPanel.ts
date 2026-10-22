/**
 * LessonPanel — Flight School's instruction UI (screen space): the
 * "FLIGHT SCHOOL · TRAINING" banner (lesson counter, no score / penalty), the
 * lesson card (title, prompt naming the bound keys, the key chips that light
 * up with the player's input and a refusal notice), the static
 * "NOW / NEXT" maneuver line, a completion toast and the course-complete
 * card.
 */

import Phaser from "phaser";
import { SPECIAL_MANEUVER_WORDS } from "../../core/maneuverLabels";
import type {
  LessonInputPlan,
  LessonInputView,
} from "../../tutorial/LessonInputs";
import { createHoloPanel, type HoloPanel } from "../../ui/hud/HoloPanel";
import { holoFont } from "../../ui/theme/holoFont";
import { HOLO_PALETTE, HOLO_SPACING } from "../../ui/theme/HoloTheme";
import { toCssColor } from "../../ui/theme/colorMath";
import { InputChipRow } from "./InputChipRow";
import { BANNER_HEIGHT, TrainingBanner } from "./TrainingBanner";

const CARD = {
  top: BANNER_HEIGHT + HOLO_SPACING.sm,
  width: 780,
  height: 160,
  promptSize: 15,
  titleSize: 12,
  hintSize: 12,
  chipRowFromBottom: 44,
} as const;
/** Corner hint: the course's skip / leave keys (same format as menu footers). */
const KEY_HINT = "N  SKIP LESSON      ESC / B  LEAVE";
const NOW_NEXT = { size: 12, gap: 10 } as const;
const NOTICE_HOLD_MS = 2500;
const TOAST = { size: 20, holdMs: 900, fadeMs: 300, gap: 46 } as const;
const DONE = { width: 560, height: 200, size: 15 } as const;
/** Depth above the battle HUD. */
const UI_DEPTH = 1100;

/** What a lesson shows on the card besides its text. */
export interface LessonInputsShown {
  readonly plan: LessonInputPlan | null;
  readonly view: LessonInputView | null;
}

/**
 * @param maneuver - A maneuver id (null = straight).
 * @returns Its HUD words, e.g. "HOOK LEFT".
 */
function maneuverWords(maneuver: string | null): string {
  return (maneuver ?? "straight")
    .split("_")
    .map((part) => SPECIAL_MANEUVER_WORDS[part] ?? part.toUpperCase())
    .join(" ");
}

/** Text options of a line on the card. */
interface CardTextStyle {
  readonly size: number;
  readonly color: number;
  readonly origin: readonly [number, number];
  readonly weight?: "400" | "600";
  readonly wrap?: number;
}

function cardText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  style: CardTextStyle,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, "", {
      ...holoFont(style.size, style.weight ?? "600"),
      color: toCssColor(style.color),
      ...(style.wrap === undefined
        ? {}
        : {
            wordWrap: { width: style.wrap },
            lineSpacing: HOLO_SPACING.xxs,
          }),
    })
    .setOrigin(style.origin[0], style.origin[1]);
}

/**
 * Add the card's text lines (title, prompt, refusal notice, key hint).
 *
 * @param scene - Flight School scene.
 * @param card - The lesson card.
 * @returns The lines the panel updates.
 */
function addCardLines(
  scene: Phaser.Scene,
  card: HoloPanel,
): Record<"title" | "prompt" | "notice", Phaser.GameObjects.Text> {
  const left = -CARD.width / 2 + HOLO_SPACING.lg;
  const right = CARD.width / 2 - HOLO_SPACING.lg;
  const bottom = CARD.height / 2 - HOLO_SPACING.sm;
  const title = cardText(scene, right, -CARD.height / 2 + HOLO_SPACING.sm, {
    size: CARD.titleSize,
    color: HOLO_PALETTE.accent,
    origin: [1, 0],
  });
  const prompt = cardText(scene, left, card.contentTop + HOLO_SPACING.xs, {
    size: CARD.promptSize,
    weight: "400",
    color: HOLO_PALETTE.textPrimary,
    origin: [0, 0],
    wrap: CARD.width - HOLO_SPACING.lg * 2,
  });
  const notice = cardText(scene, left, bottom, {
    size: CARD.hintSize,
    color: HOLO_PALETTE.warning,
    origin: [0, 1],
  });
  const hint = cardText(scene, right, bottom, {
    size: CARD.hintSize,
    color: HOLO_PALETTE.textMuted,
    origin: [1, 1],
  }).setText(KEY_HINT);
  card.add([title, prompt, notice, hint]);
  return { title, prompt, notice };
}

/** Flight School instruction overlay. */
export class LessonPanel {
  private readonly card: HoloPanel;
  private readonly title: Phaser.GameObjects.Text;
  private readonly prompt: Phaser.GameObjects.Text;
  private readonly notice: Phaser.GameObjects.Text;
  private readonly chips: InputChipRow;
  private readonly banner: TrainingBanner;
  private readonly nowNext: Phaser.GameObjects.Text;
  private readonly toast: Phaser.GameObjects.Text;
  private noticeUntilMs = 0;

  /** @param scene - Flight School scene. */
  constructor(private readonly scene: Phaser.Scene) {
    const cx = scene.scale.width / 2;
    this.card = createHoloPanel(scene, cx, CARD.top + CARD.height / 2, {
      width: CARD.width,
      height: CARD.height,
      title: "Flight School",
    });
    const lines = addCardLines(scene, this.card);
    this.title = lines.title;
    this.prompt = lines.prompt;
    this.notice = lines.notice;
    this.chips = new InputChipRow(
      scene,
      this.card,
      -CARD.width / 2 + HOLO_SPACING.lg,
      CARD.height / 2 - CARD.chipRowFromBottom,
    );
    this.banner = new TrainingBanner(scene);
    const lineY = CARD.top + CARD.height + NOW_NEXT.gap;
    this.nowNext = cardText(scene, cx, lineY, {
      size: NOW_NEXT.size,
      color: HOLO_PALETTE.textSecondary,
      origin: [0.5, 0],
    });
    this.toast = cardText(scene, cx, lineY + TOAST.gap, {
      size: TOAST.size,
      color: HOLO_PALETTE.success,
      origin: [0.5, 0.5],
    }).setAlpha(0);
    for (const obj of [this.nowNext, this.toast])
      obj.setScrollFactor(0).setDepth(UI_DEPTH);
    this.card.setScrollFactor(0, 0, true).setDepth(UI_DEPTH);
  }

  /**
   * @param index - Lesson index (0-based).
   * @param total - Number of lessons.
   * @param title - Lesson title.
   * @param prompt - Instruction text.
   * @param inputs - The lesson's key chips and their first picture.
   */
  showLesson(
    index: number,
    total: number,
    title: string,
    prompt: string,
    inputs: LessonInputsShown,
  ): void {
    this.title.setText(title.toUpperCase());
    this.banner.setLesson(index, total);
    this.prompt.setText(prompt);
    this.notice.setText("");
    this.noticeUntilMs = 0;
    this.chips.setPlan(inputs.plan, inputs.view);
  }

  /**
   * @param view - The key chips as they are now.
   * @param nowMs - Scene time (expires the refusal notice).
   */
  setInputs(view: LessonInputView, nowMs: number): void {
    this.chips.update(view);
    if (this.noticeUntilMs === 0 || nowMs < this.noticeUntilMs) return;
    this.notice.setText("");
    this.noticeUntilMs = 0;
  }

  /**
   * Say why a gesture did nothing (stressed, recharging, not on the dial).
   *
   * @param text - Reason.
   * @param nowMs - Scene time.
   */
  showNotice(text: string, nowMs: number): void {
    this.notice.setText(text);
    this.noticeUntilMs = nowMs + NOTICE_HOLD_MS;
  }

  /**
   * Show what flies now and what is queued next. Static text: only rewritten
   * when the maneuvers change.
   *
   * @param now - Maneuver flying now.
   * @param next - Maneuver queued (null = straight).
   */
  setManeuvers(now: string | null, next: string | null): void {
    const text = `NOW: ${maneuverWords(now)}   NEXT: ${maneuverWords(next)}`;
    if (this.nowNext.text !== text) this.nowNext.setText(text);
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
    this.nowNext.setVisible(false);
    this.banner.setComplete();
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
