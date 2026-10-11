/**
 * EncyclopediaStatBlock — the "COMBAT STATS" section of the encyclopedia
 * detail panel: a caption heading with an accent rule, five segmented holo
 * gauges (one segment per stat point) with numeric values, and the scale
 * note ("Standard scale (1-5)" / "★ Capital scale (1-10)").
 */

import Phaser from "phaser";
import type { EncyclopediaEntry } from "../../data/ShipEncyclopedia";
import { drawHoloGauge, type HoloRect } from "../menu/holoChrome";
import { holoFont } from "../theme/holoFont";
import { toCssColor } from "../theme/colorMath";
import {
  HOLO_ALPHA,
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
  SIDE_COLORS,
} from "../theme/HoloTheme";

/** Encyclopedia stat keys shown as gauges. */
type StatKey = "speed" | "maneuverability" | "attack" | "defense" | "payload";

/** Gauge label and colour per stat (palette-harmonised). */
const STAT_META: ReadonlyArray<{
  readonly key: StatKey;
  readonly label: string;
  readonly color: number;
}> = [
  { key: "speed", label: "SPEED", color: HOLO_PALETTE.accent },
  { key: "maneuverability", label: "MANEUVER", color: HOLO_PALETTE.success },
  { key: "attack", label: "ATTACK", color: HOLO_PALETTE.danger },
  { key: "defense", label: "DEFENSE", color: SIDE_COLORS.ally },
  { key: "payload", label: "PAYLOAD", color: HOLO_PALETTE.warning },
];

/** Block geometry. */
const STAT_LAYOUT = {
  /** Heading row height (caption + rule). */
  headingHeight: 24,
  /** Row pitch. */
  rowHeight: 34,
  /** Label column width. */
  labelWidth: 112,
  /** Value column width. */
  valueWidth: 72,
  /** Gauge thickness. */
  gaugeHeight: 10,
  /** Segment separator width. */
  segmentGap: 2,
  /** Value text size. */
  valueSize: 14,
} as const;

/** Stat point value at which the capital (1-10) scale applies. */
const CAPITAL_SCALE_MAX = 10;

/** Combat stats section of the detail panel. */
export class EncyclopediaStatBlock {
  private readonly heading: Phaser.GameObjects.Text;
  private readonly rule: Phaser.GameObjects.Graphics;
  private readonly gauges: Phaser.GameObjects.Graphics;
  private readonly values: Phaser.GameObjects.Text[] = [];
  private readonly scaleNote: Phaser.GameObjects.Text;
  private readonly gaugeX: number;
  private readonly gaugeWidth: number;
  private readonly firstRowY: number;

  /**
   * @param scene - Owning scene.
   * @param area - Block bounds (heading at the top, note at the bottom).
   * @param accent - Initial heading rule accent.
   */
  constructor(
    scene: Phaser.Scene,
    private readonly area: HoloRect,
    accent: number,
  ) {
    const caption = HOLO_TYPE_SCALE.caption;
    this.heading = scene.add
      .text(area.x, area.y, "COMBAT STATS", {
        ...holoFont(caption.size, caption.weight),
        color: toCssColor(HOLO_PALETTE.textSecondary),
      })
      .setLetterSpacing(caption.letterSpacing);
    this.rule = scene.add.graphics();
    this.setAccent(accent);
    this.gaugeX = area.x + STAT_LAYOUT.labelWidth;
    this.gaugeWidth =
      area.width - STAT_LAYOUT.labelWidth - STAT_LAYOUT.valueWidth;
    this.firstRowY = area.y + STAT_LAYOUT.headingHeight + HOLO_SPACING.sm;
    this.gauges = scene.add.graphics();
    STAT_META.forEach(({ label }, i) => this.createRowText(scene, label, i));
    this.scaleNote = scene.add
      .text(area.x + area.width, area.y + area.height, "", {
        ...holoFont(caption.size, "400"),
        color: toCssColor(HOLO_PALETTE.textMuted),
      })
      .setOrigin(1, 1);
  }

  /**
   * Recolour the heading rule.
   *
   * @param accent - Rule colour (faction accent).
   */
  setAccent(accent: number): void {
    const g = this.rule;
    const y = this.area.y + STAT_LAYOUT.headingHeight - HOLO_SPACING.xs;
    g.clear();
    g.lineStyle(HOLO_BORDER.hairline, accent, HOLO_ALPHA.structure);
    g.lineBetween(this.area.x, y, this.area.x + this.area.width, y);
    g.lineStyle(HOLO_BORDER.regular, accent, 1);
    g.lineBetween(this.area.x, y, this.area.x + this.heading.width, y);
  }

  /**
   * Show an entry's normalised stats.
   *
   * @param entry - Encyclopedia entry.
   */
  show(entry: EncyclopediaEntry): void {
    const max = entry.stats.maxStat;
    this.gauges.clear();
    STAT_META.forEach(({ key, color }, i) => {
      const value = entry.stats[key];
      this.drawGauge(i, value / max, color, max);
      this.values[i]?.setText(`${value} / ${max}`);
    });
    this.scaleNote.setText(
      max === CAPITAL_SCALE_MAX
        ? "★ Capital scale (1-10)"
        : "Standard scale (1-5)",
    );
  }

  private rowCenterY(index: number): number {
    return (
      this.firstRowY + index * STAT_LAYOUT.rowHeight + STAT_LAYOUT.rowHeight / 2
    );
  }

  private createRowText(
    scene: Phaser.Scene,
    label: string,
    index: number,
  ): void {
    const caption = HOLO_TYPE_SCALE.caption;
    const y = this.rowCenterY(index);
    scene.add
      .text(this.area.x, y, label, {
        ...holoFont(caption.size, caption.weight),
        color: toCssColor(HOLO_PALETTE.textSecondary),
      })
      .setLetterSpacing(caption.letterSpacing)
      .setOrigin(0, 0.5);
    this.values.push(
      scene.add
        .text(this.area.x + this.area.width, y, "", {
          ...holoFont(STAT_LAYOUT.valueSize, HOLO_TYPE_SCALE.numeric.weight),
          color: toCssColor(HOLO_PALETTE.textPrimary),
        })
        .setOrigin(1, 0.5),
    );
  }

  private drawGauge(
    index: number,
    fraction: number,
    color: number,
    segments: number,
  ): void {
    const g = this.gauges;
    const rect = {
      x: this.gaugeX,
      y: this.rowCenterY(index) - STAT_LAYOUT.gaugeHeight / 2,
      width: this.gaugeWidth - HOLO_SPACING.lg,
      height: STAT_LAYOUT.gaugeHeight,
    };
    drawHoloGauge(g, rect, fraction, color);
    g.fillStyle(HOLO_PALETTE.panelFill, 1);
    for (let s = 1; s < segments; s++) {
      const x = rect.x + (rect.width * s) / segments;
      g.fillRect(
        x - STAT_LAYOUT.segmentGap / 2,
        rect.y,
        STAT_LAYOUT.segmentGap,
        rect.height,
      );
    }
  }
}
