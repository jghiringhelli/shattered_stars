/**
 * InputChipRow — the lesson card's row of key chips: each stage of the
 * lesson's gesture is a hint word ("hold", "tap again") and its key chips,
 * which light up while the player holds the key. Redrawn only when the
 * model's picture changes.
 */

import Phaser from "phaser";
import type {
  LessonInputPlan,
  LessonInputView,
  StageView,
} from "../../tutorial/LessonInputs";
import { holoFont } from "../../ui/theme/holoFont";
import { HOLO_PALETTE } from "../../ui/theme/HoloTheme";
import { toCssColor } from "../../ui/theme/colorMath";

const CHIP = {
  size: 14,
  padX: 8,
  padY: 3,
  gap: 6,
  stageGap: 14,
  hintSize: 12,
} as const;
const ARROW = "→";
const INPUT_OK_TEXT = "✓ INPUT OK";
const LESSON_DONE_TEXT = "✓ LESSON DONE";

/** Colours of a chip in each state. */
const LOOK = {
  idle: {
    fill: toCssColor(HOLO_PALETTE.panelFillRaised),
    text: toCssColor(HOLO_PALETTE.textSecondary),
  },
  lit: {
    fill: toCssColor(HOLO_PALETTE.accent),
    text: toCssColor(HOLO_PALETTE.panelFill),
  },
  done: {
    fill: toCssColor(HOLO_PALETTE.success),
    text: toCssColor(HOLO_PALETTE.panelFill),
  },
} as const;

/** The chips of one lesson, drawn into a parent container. */
export class InputChipRow {
  private objects: Phaser.GameObjects.Text[] = [];
  private chips: Phaser.GameObjects.Text[][] = [];
  private hints: Phaser.GameObjects.Text[] = [];
  private doneLabel: Phaser.GameObjects.Text | null = null;
  private picture = "";

  /**
   * @param scene - Flight School scene.
   * @param parent - Container (the lesson card) the chips are added to.
   * @param left - Left edge in the parent's coordinates.
   * @param y - Row centre in the parent's coordinates.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly parent: Phaser.GameObjects.Container,
    private readonly left: number,
    private readonly y: number,
  ) {}

  /**
   * Lay out a lesson's chips.
   *
   * @param plan - The lesson's input plan (null clears the row).
   * @param view - Its first picture.
   */
  setPlan(plan: LessonInputPlan | null, view: LessonInputView | null): void {
    this.objects.forEach((obj) => obj.destroy());
    this.objects = [];
    this.chips = [];
    this.hints = [];
    this.doneLabel = null;
    this.picture = "";
    if (!plan || !view) return;
    let x = this.left;
    view.stages.forEach((stage, index) => {
      if (index > 0) x = this.place(this.text(ARROW, "idle"), x, CHIP.gap);
      const hint = this.hintText(stage);
      this.hints.push(hint);
      x = this.place(hint, x, CHIP.gap);
      this.chips.push(
        stage.chips.map((chip) => {
          const obj = this.text(chip.label, "idle", true);
          x = this.place(obj, x, CHIP.gap);
          return obj;
        }),
      );
    });
    this.doneLabel = this.text(LESSON_DONE_TEXT, "done");
    this.doneLabel.setColor(LOOK.done.fill);
    this.place(this.doneLabel, x + CHIP.stageGap, 0);
    this.update(view);
  }

  /**
   * Recolour the chips to the model's picture.
   *
   * @param view - What to draw now.
   */
  update(view: LessonInputView): void {
    const picture = JSON.stringify(view);
    if (picture === this.picture) return;
    this.picture = picture;
    view.stages.forEach((stage, index) => {
      this.hints[index]?.setText(this.hintLabel(stage));
      this.hints[index]?.setColor(
        toCssColor(
          stage.state === "active"
            ? HOLO_PALETTE.textPrimary
            : HOLO_PALETTE.textMuted,
        ),
      );
      stage.chips.forEach((chip, chipIndex) => {
        const obj = this.chips[index]?.[chipIndex];
        if (!obj) return;
        const look =
          stage.state === "complete" && !chip.lit
            ? LOOK.done
            : chip.lit
              ? LOOK.lit
              : LOOK.idle;
        obj.setBackgroundColor(look.fill).setColor(look.text);
      });
    });
    this.doneLabel?.setVisible(view.done || view.finished);
    this.doneLabel?.setText(view.finished ? LESSON_DONE_TEXT : INPUT_OK_TEXT);
  }

  /** Hide or show the whole row. */
  setVisible(visible: boolean): void {
    this.objects.forEach((obj) => obj.setVisible(visible));
  }

  private hintLabel(stage: StageView): string {
    return stage.progress ? `${stage.hint} ${stage.progress}` : stage.hint;
  }

  private hintText(stage: StageView): Phaser.GameObjects.Text {
    const obj = this.scene.add
      .text(0, this.y, this.hintLabel(stage), {
        ...holoFont(CHIP.hintSize, "600"),
        color: toCssColor(HOLO_PALETTE.textMuted),
      })
      .setOrigin(0, 0.5);
    this.track(obj);
    return obj;
  }

  private text(
    label: string,
    look: keyof typeof LOOK,
    chip = false,
  ): Phaser.GameObjects.Text {
    const obj = this.scene.add
      .text(0, this.y, label, {
        ...holoFont(CHIP.size, "600"),
        color: chip ? LOOK[look].text : toCssColor(HOLO_PALETTE.textMuted),
        ...(chip
          ? {
              backgroundColor: LOOK[look].fill,
              padding: { x: CHIP.padX, y: CHIP.padY },
            }
          : {}),
      })
      .setOrigin(0, 0.5);
    this.track(obj);
    return obj;
  }

  private track(obj: Phaser.GameObjects.Text): void {
    this.objects.push(obj);
    this.parent.add(obj);
  }

  /** Put `obj` at `x` and return the x after it plus `gap`. */
  private place(obj: Phaser.GameObjects.Text, x: number, gap: number): number {
    obj.setX(x);
    return x + obj.width + gap;
  }
}
