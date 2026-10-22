/**
 * StressReadout — the stress row of the FlightReadout: a state glyph, a
 * numeric counter ("STRESS 42%") and a state label (CALM / NORMAL /
 * RECOVERING / STRESSED). State comes from the HUD's own memory of the
 * previous level (see stressState); entering and leaving STRESSED pulses a
 * highlight once (steady under Reduce Motion). Texts only change on change.
 *
 * Origin: children are positioned in the FlightReadout's container space.
 */

import Phaser from "phaser";
import { toCssColor } from "../theme/colorMath";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { isMotionReduced } from "../settings/motionComfort";
import { createHoloText } from "./holoPrimitives";
import { drawStressGlyph, type GlyphBox } from "./stressGlyphs";
import {
  INITIAL_STRESS_TRACK,
  emphasisAlpha,
  stepStressTrack,
  stressCounterText,
  stressLabel,
  type StressKind,
  type StressTrack,
} from "./stressState";
import type { PlayerHudState } from "./types";

const NO_VALUE = "–";
const GLYPH_SIZE = 14;
const HIGHLIGHT_INSET = { x: 4, height: 18 } as const;

/** State colours (live tokens, so colour-vision palettes apply). */
function stateColor(kind: StressKind, locked: boolean): number {
  if (kind === "stressed" || (kind === "recovering" && locked)) {
    return HOLO_PALETTE.danger;
  }
  if (kind === "recovering") return HOLO_PALETTE.warning;
  return kind === "calm" ? HOLO_PALETTE.success : HOLO_PALETTE.textPrimary;
}

/** Where the stress row sits (parent container space). */
export interface StressRowLayout {
  /** Row left edge. */
  readonly left: number;
  /** Row right edge. */
  readonly right: number;
  /** Row centre y. */
  readonly y: number;
  /** Glyph centre x. */
  readonly glyphX: number;
  /** Counter text x. */
  readonly valueX: number;
}

/** Stress counter + state label row. */
export class StressReadout {
  private readonly left: number;
  private readonly right: number;
  private readonly y: number;
  private readonly glyphX: number;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly counterText: Phaser.GameObjects.Text;
  private readonly labelText: Phaser.GameObjects.Text;
  private track: StressTrack = INITIAL_STRESS_TRACK;
  private wasStressed: boolean | null = null;
  private emphasisStart = Number.NEGATIVE_INFINITY;
  private emphasisColor: number = HOLO_PALETTE.danger;

  /**
   * @param scene - Owning scene (its clock times the emphasis).
   * @param row - Row geometry in the parent container space.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    row: StressRowLayout,
  ) {
    const { left, right, y, glyphX, valueX } = row;
    this.left = left;
    this.right = right;
    this.y = y;
    this.glyphX = glyphX;
    this.graphics = scene.add.graphics();
    this.counterText = createHoloText(
      scene,
      valueX,
      y,
      NO_VALUE,
      "body",
    ).setOrigin(0, 0.5);
    this.labelText = createHoloText(
      scene,
      right - 8,
      y,
      "",
      "caption",
      HOLO_PALETTE.textSecondary,
    ).setOrigin(1, 0.5);
  }

  private glyphBox(color: number): GlyphBox {
    return { cx: this.glyphX, cy: this.y, size: GLYPH_SIZE, color };
  }

  /** Game objects to add to the parent container. */
  get objects(): Array<Phaser.GameObjects.Graphics | Phaser.GameObjects.Text> {
    return [this.graphics, this.counterText, this.labelText];
  }

  /** Current stress state (drives the screen-edge tint too). */
  get stressTrack(): StressTrack {
    return this.track;
  }

  /**
   * Refresh the row.
   *
   * @param player - Player state; null shows placeholders and resets memory.
   */
  update(player: PlayerHudState | null): void {
    const g = this.graphics;
    g.clear();
    if (!player) {
      this.track = INITIAL_STRESS_TRACK;
      this.wasStressed = null;
      setIfChanged(this.counterText, NO_VALUE);
      setIfChanged(this.labelText, "");
      drawStressGlyph(g, "calm", this.glyphBox(HOLO_PALETTE.textMuted));
      return;
    }
    this.track = stepStressTrack(this.track, player.stress, player.isStressed);
    this.noteLatchChange(player.isStressed);
    const color = stateColor(this.track.kind, this.track.locked);
    this.drawEmphasis();
    drawStressGlyph(g, this.track.kind, this.glyphBox(color));
    setIfChanged(this.counterText, stressCounterText(player.stress));
    setIfChanged(this.labelText, stressLabel(this.track));
    const css = toCssColor(color);
    if (this.labelText.style.color !== css) this.labelText.setColor(css);
  }

  private noteLatchChange(isStressed: boolean): void {
    if (this.wasStressed !== null && this.wasStressed !== isStressed) {
      this.emphasisStart = this.scene.time.now;
      this.emphasisColor = isStressed
        ? HOLO_PALETTE.danger
        : HOLO_PALETTE.success;
    }
    this.wasStressed = isStressed;
  }

  private drawEmphasis(): void {
    const alpha = emphasisAlpha(
      this.scene.time.now - this.emphasisStart,
      isMotionReduced(),
    );
    if (alpha <= 0) return;
    this.graphics.fillStyle(this.emphasisColor, alpha);
    this.graphics.fillRoundedRect(
      this.left + HIGHLIGHT_INSET.x,
      this.y - HIGHLIGHT_INSET.height / 2,
      this.right - this.left - HIGHLIGHT_INSET.x * 2,
      HIGHLIGHT_INSET.height,
      3,
    );
  }
}

function setIfChanged(text: Phaser.GameObjects.Text, value: string): void {
  if (text.text !== value) text.setText(value);
}
