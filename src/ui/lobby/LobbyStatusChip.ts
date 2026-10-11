/**
 * LobbyStatusChip — the lobby's connection / activity status line, drawn as
 * a centred pill: a tone-coloured dot and caption text inside a faint tinted
 * frame (success = connected, warning = working, danger = error).
 */

import type Phaser from "phaser";
import { drawHoloFrame } from "../menu/holoChrome";
import { HOLO_SPACING } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import {
  STATUS_TONE_COLORS,
  addLobbyText,
  type StatusTone,
} from "./lobbyLayout";

/** Chip geometry and opacity. */
const CHIP = {
  height: 26,
  paddingX: HOLO_SPACING.md,
  dotRadius: 3.5,
  dotGap: HOLO_SPACING.sm,
  fillAlpha: 0.14,
  borderAlpha: 0.7,
  textSize: 12,
  letterSpacing: 0.5,
} as const;

/** Centred status pill. */
export class LobbyStatusChip {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private tone: StatusTone = "neutral";

  /**
   * @param scene - Owning scene.
   * @param center - Pill centre.
   * @param initialText - First message.
   */
  constructor(
    scene: Phaser.Scene,
    private readonly center: { readonly x: number; readonly y: number },
    initialText: string,
  ) {
    this.frame = scene.add.graphics();
    this.label = addLobbyText(scene, center, initialText, {
      size: CHIP.textSize,
      weight: "600",
      letterSpacing: CHIP.letterSpacing,
    });
    this.redraw();
  }

  /** Current message. */
  get text(): string {
    return this.label.text;
  }

  /**
   * Show a message; the tone is kept when omitted.
   *
   * @param text - Message.
   * @param tone - New tone (optional).
   */
  setStatus(text: string, tone?: StatusTone): void {
    if (tone !== undefined) this.tone = tone;
    this.label.setText(text);
    this.redraw();
  }

  private redraw(): void {
    const color = STATUS_TONE_COLORS[this.tone];
    const contentWidth = CHIP.dotRadius * 2 + CHIP.dotGap + this.label.width;
    const width = contentWidth + CHIP.paddingX * 2;
    const left = this.center.x - width / 2;
    const top = this.center.y - CHIP.height / 2;
    const g = this.frame;
    g.clear();
    drawHoloFrame(
      g,
      { x: left, y: top, width, height: CHIP.height },
      {
        accent: color,
        fill: color,
        fillAlpha: CHIP.fillAlpha,
        borderAlpha: CHIP.borderAlpha,
        radius: CHIP.height / 2,
      },
    );
    g.fillStyle(color, 1);
    g.fillCircle(
      left + CHIP.paddingX + CHIP.dotRadius,
      this.center.y,
      CHIP.dotRadius,
    );
    this.label
      .setX(left + CHIP.paddingX + CHIP.dotRadius * 2 + CHIP.dotGap)
      .setColor(toCssColor(color));
  }
}
