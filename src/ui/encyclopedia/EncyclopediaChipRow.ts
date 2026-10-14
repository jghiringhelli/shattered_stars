/**
 * EncyclopediaChipRow — a row of holo toggle chips (one selected at a time):
 * the encyclopedia's faction filter and its section tabs. Each chip carries
 * an accent (underline when idle, tinted fill + border when selected).
 */

import Phaser from "phaser";
import type { TermId } from "../../data/tooltips";
import { attachTermTooltip } from "../menu/HintTooltip";
import { drawHoloFrame, type HoloRect } from "../menu/holoChrome";
import { holoFont } from "../theme/holoFont";
import { toCssColor } from "../theme/colorMath";
import {
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_RADIUS,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
} from "../theme/HoloTheme";
import { ENCYCLOPEDIA_LAYOUT } from "./encyclopediaLayout";

/** Selected chip tint opacity. */
const SELECTED_FILL_ALPHA = 0.24;
/** Hovered chip border opacity. */
const HOVER_BORDER_ALPHA = 0.9;
/** Idle underline opacity. */
const UNDERLINE_ALPHA = 0.8;
/** Idle underline thickness. */
const UNDERLINE_HEIGHT = 2;

/** One chip: the value it selects, its label and its accent. */
export interface ChipSpec<T> {
  readonly value: T;
  readonly label: string;
  readonly accent: number;
  /** Tooltip term explaining the chip. */
  readonly tip?: TermId;
}

/** One chip's display objects and state. */
interface ChipView<T> {
  readonly spec: ChipSpec<T>;
  readonly face: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  readonly rect: HoloRect;
  hovered: boolean;
}

/** Row of single-select holo chips sharing the row width evenly. */
export class EncyclopediaChipRow<T> {
  private readonly chips: ChipView<T>[] = [];
  private active: T;

  /**
   * @param scene - Owning scene.
   * @param area - Row bounds.
   * @param specs - The chips, left to right (the first starts selected).
   * @param onSelect - Invoked with the chip's value on press.
   */
  constructor(
    scene: Phaser.Scene,
    area: HoloRect,
    specs: ReadonlyArray<ChipSpec<T>>,
    onSelect: (value: T) => void,
  ) {
    const gap = ENCYCLOPEDIA_LAYOUT.chipGap;
    const width = (area.width - gap * (specs.length - 1)) / specs.length;
    specs.forEach((spec, i) => {
      const rect = { ...area, x: area.x + i * (width + gap), width };
      const chip = this.createChip(scene, rect, spec);
      this.chips.push(chip);
      this.bindChip(scene, chip, onSelect);
    });
    this.active = specs[0]!.value;
    this.redrawAll();
  }

  /**
   * Mark the chip holding a value as selected.
   * @param value - The selected value.
   */
  setActive(value: T): void {
    this.active = value;
    this.redrawAll();
  }

  private createChip(
    scene: Phaser.Scene,
    rect: HoloRect,
    spec: ChipSpec<T>,
  ): ChipView<T> {
    const caption = HOLO_TYPE_SCALE.caption;
    const face = scene.add.graphics();
    const label = scene.add
      .text(rect.x + rect.width / 2, rect.y + rect.height / 2, spec.label, {
        ...holoFont(caption.size, caption.weight),
      })
      .setLetterSpacing(caption.letterSpacing)
      .setOrigin(0.5);
    return { spec, face, label, rect, hovered: false };
  }

  private bindChip(
    scene: Phaser.Scene,
    chip: ChipView<T>,
    onSelect: (value: T) => void,
  ): void {
    const { rect } = chip;
    const hit = scene.add
      .zone(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        rect.width,
        rect.height,
      )
      .setInteractive({ useHandCursor: true });
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      chip.hovered = true;
      this.redraw(chip);
    });
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      chip.hovered = false;
      this.redraw(chip);
    });
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () =>
      onSelect(chip.spec.value),
    );
    if (chip.spec.tip) attachTermTooltip(scene, hit, chip.spec.tip);
  }

  private redrawAll(): void {
    this.chips.forEach((chip) => this.redraw(chip));
  }

  private redraw(chip: ChipView<T>): void {
    const { accent } = chip.spec;
    const selected = chip.spec.value === this.active;
    const { face, rect } = chip;
    face.clear();
    if (selected) {
      drawHoloFrame(face, rect, {
        radius: HOLO_RADIUS.sm,
        accent,
        fill: accent,
        fillAlpha: SELECTED_FILL_ALPHA,
        borderWidth: HOLO_BORDER.regular,
        borderAlpha: 1,
      });
    } else {
      drawHoloFrame(face, rect, {
        radius: HOLO_RADIUS.sm,
        accent: chip.hovered ? accent : HOLO_PALETTE.border,
        borderAlpha: chip.hovered
          ? HOVER_BORDER_ALPHA
          : HOLO_PALETTE.borderAlpha,
        fill: chip.hovered
          ? HOLO_PALETTE.panelFillRaised
          : HOLO_PALETTE.panelFill,
      });
      face.fillStyle(accent, UNDERLINE_ALPHA);
      face.fillRect(
        rect.x + HOLO_SPACING.md,
        rect.y + rect.height - HOLO_SPACING.xs - UNDERLINE_HEIGHT,
        rect.width - HOLO_SPACING.md * 2,
        UNDERLINE_HEIGHT,
      );
    }
    const textColor =
      selected || chip.hovered
        ? HOLO_PALETTE.textPrimary
        : HOLO_PALETTE.textSecondary;
    chip.label.setColor(toCssColor(textColor));
  }
}
