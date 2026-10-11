/**
 * FactionFilterChips — a row of holo toggle chips that filter the ship
 * encyclopedia by faction. Each faction chip carries its faction accent
 * (underline when idle, tinted fill + border when selected); ALL is neutral.
 */

import Phaser from "phaser";
import type { FactionId } from "../../config";
import { drawHoloFrame, type HoloRect } from "../menu/holoChrome";
import { holoFont } from "../theme/holoFont";
import { toCssColor } from "../theme/colorMath";
import {
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_RADIUS,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
  factionAccent,
} from "../theme/HoloTheme";
import { ENCYCLOPEDIA_LAYOUT, FACTION_CHIPS } from "./encyclopediaLayout";

/** Selected chip tint opacity. */
const SELECTED_FILL_ALPHA = 0.24;
/** Hovered chip border opacity. */
const HOVER_BORDER_ALPHA = 0.9;
/** Idle faction underline opacity. */
const UNDERLINE_ALPHA = 0.8;
/** Idle faction underline thickness. */
const UNDERLINE_HEIGHT = 2;

/** One chip's display objects and state. */
interface ChipView {
  readonly faction: FactionId | null;
  readonly face: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  readonly rect: HoloRect;
  hovered: boolean;
}

/** Row of faction filter chips. */
export class FactionFilterChips {
  private readonly chips: ChipView[] = [];
  private active: FactionId | null = null;

  /**
   * @param scene - Owning scene.
   * @param area - Row bounds; chips share the width evenly.
   * @param onSelect - Invoked with the chip's faction (null = ALL) on press.
   */
  constructor(
    scene: Phaser.Scene,
    area: HoloRect,
    onSelect: (faction: FactionId | null) => void,
  ) {
    const gap = ENCYCLOPEDIA_LAYOUT.chipGap;
    const count = FACTION_CHIPS.length;
    const chipWidth = (area.width - gap * (count - 1)) / count;
    FACTION_CHIPS.forEach((spec, i) => {
      const rect = {
        x: area.x + i * (chipWidth + gap),
        y: area.y,
        width: chipWidth,
        height: area.height,
      };
      this.chips.push(this.createChip(scene, rect, spec.faction, spec.label));
    });
    this.chips.forEach((chip) => this.bindChip(scene, chip, onSelect));
    this.redrawAll();
  }

  /**
   * Mark the chip for a faction as selected.
   *
   * @param faction - Selected faction, or null for ALL.
   */
  setActive(faction: FactionId | null): void {
    this.active = faction;
    this.redrawAll();
  }

  private createChip(
    scene: Phaser.Scene,
    rect: HoloRect,
    faction: FactionId | null,
    text: string,
  ): ChipView {
    const caption = HOLO_TYPE_SCALE.caption;
    const face = scene.add.graphics();
    const label = scene.add
      .text(rect.x + rect.width / 2, rect.y + rect.height / 2, text, {
        ...holoFont(caption.size, caption.weight),
      })
      .setLetterSpacing(caption.letterSpacing)
      .setOrigin(0.5);
    return { faction, face, label, rect, hovered: false };
  }

  private bindChip(
    scene: Phaser.Scene,
    chip: ChipView,
    onSelect: (faction: FactionId | null) => void,
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
      onSelect(chip.faction),
    );
  }

  private redrawAll(): void {
    this.chips.forEach((chip) => this.redraw(chip));
  }

  private redraw(chip: ChipView): void {
    const accent = factionAccent(chip.faction ?? undefined);
    const selected = chip.faction === this.active;
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
      this.drawUnderline(face, rect, accent);
    }
    const textColor =
      selected || chip.hovered
        ? HOLO_PALETTE.textPrimary
        : HOLO_PALETTE.textSecondary;
    chip.label.setColor(toCssColor(textColor));
  }

  private drawUnderline(
    g: Phaser.GameObjects.Graphics,
    rect: HoloRect,
    accent: number,
  ): void {
    g.fillStyle(accent, UNDERLINE_ALPHA);
    g.fillRect(
      rect.x + HOLO_SPACING.md,
      rect.y + rect.height - HOLO_SPACING.xs - UNDERLINE_HEIGHT,
      rect.width - HOLO_SPACING.md * 2,
      UNDERLINE_HEIGHT,
    );
  }
}
