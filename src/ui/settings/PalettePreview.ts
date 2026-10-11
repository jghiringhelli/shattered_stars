/**
 * Live palette preview on the Accessibility tab: the HUD's side and signal
 * glyphs (friendly/hostile blips, edge arrows, squad mark, locked target,
 * hull states) drawn from the LIVE theme tokens, redrawn on every change.
 */

import Phaser from "phaser";
import { drawArrowGlyph, drawDiamond, fillBlip } from "../hud/HudIcons";
import { drawMarkReticle } from "../hud/markGlyphs";
import { drawSideFrame, drawSideTail } from "../hud/sideGlyphs";
import { holoFont } from "../theme/holoFont";
import { HOLO_PALETTE, SIDE_COLORS, type HoloSide } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { createHoloPanel } from "../hud/HoloPanel";
import type { HoloRect } from "../menu/holoChrome";

const SAMPLE = {
  blipRadius: 6,
  arrowSize: 12,
  rowPitch: 34,
  glyphX: 34,
  labelX: 64,
  top: 46,
  labelSize: 13,
  markRadius: 13,
  markLine: 2,
  targetLine: 2,
  hullWidth: 56,
  hullHeight: 6,
} as const;

/** What each preview row shows. */
type SampleKind =
  "ally" | "enemy" | "arrow_ally" | "arrow_enemy" | "mark" | "target" | "hull";

const SAMPLES: ReadonlyArray<{
  readonly kind: SampleKind;
  readonly label: string;
}> = [
  { kind: "ally", label: "Friendly blip (ringed)" },
  { kind: "enemy", label: "Hostile blip" },
  { kind: "arrow_ally", label: "Friendly edge arrow (tail bar)" },
  { kind: "arrow_enemy", label: "Hostile edge arrow" },
  { kind: "mark", label: "Squad mark (brackets)" },
  { kind: "target", label: "Locked target (diamond)" },
  { kind: "hull", label: "Hull: healthy / damaged / critical !" },
];

/** Accessibility palette preview panel. */
export class PalettePreview {
  private readonly glyphs: Phaser.GameObjects.Graphics;

  /**
   * @param scene - Settings scene.
   * @param rect - Panel bounds.
   */
  constructor(
    scene: Phaser.Scene,
    private readonly rect: HoloRect,
  ) {
    createHoloPanel(scene, rect.x + rect.width / 2, rect.y + rect.height / 2, {
      width: rect.width,
      height: rect.height,
      title: "Preview",
    });
    this.glyphs = scene.add.graphics();
    SAMPLES.forEach((sample, i) => {
      scene.add
        .text(rect.x + SAMPLE.labelX, this.rowY(i), sample.label, {
          ...holoFont(SAMPLE.labelSize, "400"),
          color: toCssColor(HOLO_PALETTE.textSecondary),
        })
        .setOrigin(0, 0.5);
    });
    this.redraw();
  }

  /** Redraw every glyph from the live tokens. */
  redraw(): void {
    this.glyphs.clear();
    SAMPLES.forEach((sample, i) => this.drawSample(sample.kind, this.rowY(i)));
  }

  private rowY(index: number): number {
    return this.rect.y + SAMPLE.top + index * SAMPLE.rowPitch;
  }

  private drawSample(kind: SampleKind, y: number): void {
    const g = this.glyphs;
    const x = this.rect.x + SAMPLE.glyphX;
    if (kind === "ally" || kind === "enemy") return this.blip(kind, x, y);
    if (kind === "arrow_ally" || kind === "arrow_enemy") {
      return this.arrow(kind === "arrow_ally" ? "ally" : "enemy", x, y);
    }
    if (kind === "mark") {
      g.fillStyle(SIDE_COLORS.enemy, 1);
      fillBlip(g, x, y, SAMPLE.blipRadius, 0);
      drawMarkReticle(g, x, y, SAMPLE.markRadius, SAMPLE.markLine);
      return;
    }
    if (kind === "target") {
      g.fillStyle(SIDE_COLORS.enemy, 1);
      fillBlip(g, x, y, SAMPLE.blipRadius, 0);
      drawDiamond(
        g,
        x,
        y,
        SAMPLE.markRadius,
        SAMPLE.targetLine,
        HOLO_PALETTE.target,
        1,
      );
      return;
    }
    this.hullBars(x, y);
  }

  private blip(side: HoloSide, x: number, y: number): void {
    const color = SIDE_COLORS[side];
    this.glyphs.fillStyle(color, 1);
    fillBlip(this.glyphs, x, y, SAMPLE.blipRadius, 0);
    drawSideFrame(
      this.glyphs,
      side,
      { x, y, radius: SAMPLE.blipRadius },
      color,
      1,
    );
  }

  private arrow(side: HoloSide, x: number, y: number): void {
    // Glyph helpers draw at the origin: draw into a translated frame.
    const g = this.glyphs;
    g.save();
    g.translateCanvas(x, y);
    drawArrowGlyph(g, SAMPLE.arrowSize, SIDE_COLORS[side]);
    drawSideTail(g, side, SAMPLE.arrowSize, SIDE_COLORS[side]);
    g.restore();
  }

  private hullBars(x: number, y: number): void {
    const colors = [
      HOLO_PALETTE.success,
      HOLO_PALETTE.warning,
      HOLO_PALETTE.danger,
    ];
    const third = SAMPLE.hullWidth / colors.length;
    colors.forEach((color, i) => {
      this.glyphs.fillStyle(color, 1);
      this.glyphs.fillRect(
        x - SAMPLE.hullWidth / 2 + i * third,
        y - SAMPLE.hullHeight / 2,
        third - 2,
        SAMPLE.hullHeight,
      );
    });
  }
}
