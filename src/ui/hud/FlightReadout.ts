/**
 * FlightReadout — compact icon + number panel beside the radar: speed with
 * pips and the current maneuver on the top row, shields and hull on the
 * middle row, stress counter + state label (StressReadout) on the bottom
 * row. Texts only change when their value changes.
 *
 * Origin: the container sits at the panel's RIGHT edge, vertical centre.
 */

import Phaser from "phaser";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import {
  addPinned,
  createHoloText,
  createScreenContainer,
} from "./holoPrimitives";
import { HoloPanel } from "./HoloPanel";
import { StressReadout } from "./StressReadout";
import type { StressTrack } from "./stressState";
import { drawStatGlyph, type StatGlyph } from "./HudIcons";
import { gaugeFraction, hullStatus, rowCenters } from "./hudStyleMath";
import type { ScreenRect } from "./screenRect";
import type { PlayerHudState } from "./types";

const PANEL = { width: 240, height: 84 } as const;
/** Rows: speed / maneuver, shield / hull, stress (centre-to-centre pitch). */
const ROW_PITCH = 25;
const ROW_OFFSET = 0;
const SPEED_ROW = ROW_OFFSET - ROW_PITCH;
const STRESS_ROW = ROW_OFFSET + ROW_PITCH;
const GLYPH_SIZE = 14;
const VALUE_GAP = 12;
const SPEED_PIPS = { max: 6, width: 7, height: 4, gap: 3 } as const;
const STAT_COLUMN_WIDTH = 72;
const NO_VALUE = "–";
/** Hull status colours (live tokens, so colour-vision palettes apply). */
function hullColor(status: "healthy" | "damaged" | "critical"): number {
  if (status === "healthy") return HOLO_PALETTE.success;
  return status === "damaged" ? HOLO_PALETTE.warning : HOLO_PALETTE.danger;
}
/** Non-colour backup for critical hull: a "!" after the hull value. */
const CRITICAL_SUFFIX = " !";

/**
 * @param scene - Owning scene.
 * @param valueX - Left edge of the value column.
 * @returns The four value texts of the speed/shield rows.
 */
function createReadoutTexts(
  scene: Phaser.Scene,
  valueX: number,
): Record<"speed" | "maneuver" | "shield" | "hull", Phaser.GameObjects.Text> {
  return {
    speed: createHoloText(
      scene,
      valueX,
      SPEED_ROW,
      NO_VALUE,
      "numeric",
    ).setOrigin(0, 0.5),
    maneuver: createHoloText(
      scene,
      -HOLO_SPACING.md,
      SPEED_ROW,
      "",
      "caption",
      HOLO_PALETTE.textSecondary,
    ).setOrigin(1, 0.5),
    shield: createHoloText(
      scene,
      valueX,
      ROW_OFFSET,
      NO_VALUE,
      "body",
    ).setOrigin(0, 0.5),
    hull: createHoloText(
      scene,
      valueX + STAT_COLUMN_WIDTH,
      ROW_OFFSET,
      NO_VALUE,
      "body",
    ).setOrigin(0, 0.5),
  };
}

/** Speed / maneuver / shield / hull readout. */
export class FlightReadout {
  /** Screen-space container (scrollFactor 0). */
  readonly container: Phaser.GameObjects.Container;
  private readonly glyphs: Phaser.GameObjects.Graphics;
  private readonly speedText: Phaser.GameObjects.Text;
  private readonly maneuverText: Phaser.GameObjects.Text;
  private readonly shieldText: Phaser.GameObjects.Text;
  private readonly hullText: Phaser.GameObjects.Text;
  private readonly stress: StressReadout;
  private readonly left = -PANEL.width;

  /**
   * @param scene - Owning scene.
   */
  constructor(scene: Phaser.Scene) {
    this.container = createScreenContainer(scene);
    const panel = new HoloPanel(scene, -PANEL.width / 2, 0, {
      width: PANEL.width,
      height: PANEL.height,
    });
    panel.setScrollFactor(0, 0, true);
    this.glyphs = scene.add.graphics();
    const valueX = this.left + HOLO_SPACING.md + GLYPH_SIZE + HOLO_SPACING.xs;
    const texts = createReadoutTexts(scene, valueX);
    this.speedText = texts.speed;
    this.maneuverText = texts.maneuver;
    this.shieldText = texts.shield;
    this.hullText = texts.hull;
    this.stress = new StressReadout(scene, {
      left: this.left,
      right: 0,
      y: STRESS_ROW,
      glyphX: this.left + HOLO_SPACING.md + GLYPH_SIZE / 2,
      valueX,
    });
    addPinned(
      this.container,
      panel,
      this.glyphs,
      this.speedText,
      this.maneuverText,
      this.shieldText,
      this.hullText,
      ...this.stress.objects,
    );
  }

  /** The stress state the readout currently shows. */
  get stressTrack(): StressTrack {
    return this.stress.stressTrack;
  }

  /** Panel width in px. */
  get width(): number {
    return PANEL.width;
  }

  /**
   * Bounding box in the parent's coordinates.
   *
   * @returns The panel rect.
   */
  bounds(): ScreenRect {
    const { x, y } = this.container;
    return {
      x: x - PANEL.width,
      y: y - PANEL.height / 2,
      width: PANEL.width,
      height: PANEL.height,
    };
  }

  /**
   * Position the panel's right edge / vertical centre.
   *
   * @param x - Right edge x.
   * @param y - Vertical centre y.
   */
  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  /**
   * Refresh values.
   *
   * @param player - Player state; null shows placeholders.
   */
  update(player: PlayerHudState | null): void {
    const g = this.glyphs;
    g.clear();
    const glyphX = this.left + HOLO_SPACING.md + GLYPH_SIZE / 2;
    const hullState = player
      ? hullStatus(gaugeFraction(player.hull, player.maxHull))
      : null;
    const hullColorNow = hullState
      ? hullColor(hullState)
      : HOLO_PALETTE.textMuted;
    this.glyph("speed", glyphX, SPEED_ROW, HOLO_PALETTE.textSecondary);
    this.glyph("shield", glyphX, ROW_OFFSET, HOLO_PALETTE.shield);
    this.glyph("hull", glyphX + STAT_COLUMN_WIDTH, ROW_OFFSET, hullColorNow);
    setIfChanged(
      this.speedText,
      player ? String(Math.round(player.speed)) : NO_VALUE,
    );
    setIfChanged(this.maneuverText, player?.maneuver?.toUpperCase() ?? "");
    setIfChanged(
      this.shieldText,
      player ? `${Math.floor(player.shields)}/${player.maxShields}` : NO_VALUE,
    );
    setIfChanged(
      this.hullText,
      player
        ? `${Math.ceil(player.hull)}/${player.maxHull}` +
            (hullState === "critical" ? CRITICAL_SUFFIX : "")
        : NO_VALUE,
    );
    this.stress.update(player);
    if (player) this.drawSpeedPips(player.speed, player.maxSpeed);
  }

  /** Destroy all game objects. */
  destroy(): void {
    this.container.destroy();
  }

  private glyph(kind: StatGlyph, x: number, y: number, color: number): void {
    drawStatGlyph(this.glyphs, kind, x, y, GLYPH_SIZE, color);
  }

  private drawSpeedPips(speed: number, maxSpeed: number): void {
    const count = Math.min(SPEED_PIPS.max, Math.max(0, Math.floor(maxSpeed)));
    if (count === 0) return;
    const filled = Math.round(gaugeFraction(speed, maxSpeed) * count);
    const rowWidth = count * SPEED_PIPS.width + (count - 1) * SPEED_PIPS.gap;
    const startX =
      this.speedText.x + this.speedText.width + VALUE_GAP + rowWidth / 2;
    rowCenters(count, SPEED_PIPS.width, SPEED_PIPS.gap).forEach((dx, i) => {
      const lit = i < filled;
      this.glyphs.fillStyle(
        lit ? HOLO_PALETTE.accent : HOLO_PALETTE.track,
        lit ? 1 : HOLO_PALETTE.trackAlpha * 2,
      );
      this.glyphs.fillRect(
        startX + dx - SPEED_PIPS.width / 2,
        SPEED_ROW - SPEED_PIPS.height / 2,
        SPEED_PIPS.width,
        SPEED_PIPS.height,
      );
    });
  }
}

function setIfChanged(text: Phaser.GameObjects.Text, value: string): void {
  if (text.text !== value) text.setText(value);
}
