/**
 * PointsBar — the fixed footer strip of the pick screens: a budget bar
 * (spent / limit), a plain-language caption ("130 spent · 70 left of 200")
 * and a short note on the right (pool / cap / wingmen). Turns red when over
 * the limit. A refusal message can replace the caption for a moment.
 */

import type Phaser from "phaser";
import { drawHoloFrame } from "../menu/holoChrome";
import { attachTermTooltip } from "../menu/HintTooltip";
import { holoFont } from "../theme/holoFont";
import { HOLO_PALETTE, HOLO_RADIUS, HOLO_SPACING } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { budgetCaption, type PointsBudget } from "./pointsBudget";

/** Strip height (px). */
export const POINTS_BAR_H = 24;
/** Font size of the strip's text (px) — nothing under 12 px. */
const BAR_FONT_SIZE = 12;
/** Height of the budget gauge (px). */
const GAUGE_H = 6;
/** Share of the strip width the gauge takes. */
const GAUGE_SHARE = 0.22;
/** How long a refusal replaces the caption (ms). */
const REFUSAL_MS = 2600;

/** Where the strip goes. */
export interface PointsBarRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

/** The footer budget strip. */
export class PointsBar {
  private readonly root: Phaser.GameObjects.Container;
  private readonly gauge: Phaser.GameObjects.Graphics;
  private readonly caption: Phaser.GameObjects.Text;
  private readonly note: Phaser.GameObjects.Text;
  private budget: PointsBudget | null = null;
  private refusal: Phaser.Time.TimerEvent | null = null;

  /**
   * @param scene - Owning scene.
   * @param rect - Strip position and width.
   * @param accent - Faction accent for the frame and gauge.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rect: PointsBarRect,
    accent: number,
  ) {
    const style = (color: number): Phaser.Types.GameObjects.Text.TextStyle => ({
      ...holoFont(BAR_FONT_SIZE, "600"),
      color: toCssColor(color),
    });
    const frame = scene.add.graphics();
    drawHoloFrame(
      frame,
      { x: rect.x, y: rect.y, width: rect.width, height: POINTS_BAR_H },
      { accent, radius: HOLO_RADIUS.sm, fillAlpha: 0.5, borderAlpha: 0.4 },
    );
    this.gauge = scene.add.graphics();
    const textY = rect.y + POINTS_BAR_H / 2;
    const gaugeRight =
      rect.x + HOLO_SPACING.md + rect.width * GAUGE_SHARE + HOLO_SPACING.md;
    this.caption = scene.add
      .text(gaugeRight, textY, "", style(HOLO_PALETTE.textPrimary))
      .setOrigin(0, 0.5);
    this.note = scene.add
      .text(
        rect.x + rect.width - HOLO_SPACING.md,
        textY,
        "",
        { ...style(HOLO_PALETTE.textSecondary), fontStyle: "400" },
      )
      .setOrigin(1, 0.5);
    const zone = scene.add
      .rectangle(
        rect.x + rect.width / 2,
        rect.y + POINTS_BAR_H / 2,
        rect.width,
        POINTS_BAR_H,
        0,
        0,
      )
      .setInteractive();
    attachTermTooltip(scene, zone, "ui.budget_bar");
    this.root = scene.add.container(0, 0, [
      frame,
      this.gauge,
      this.caption,
      this.note,
      zone,
    ]);
  }

  /**
   * Show a budget.
   *
   * @param budget - Spent / limit.
   * @param note - Right-hand note (pool, cap, wingmen…); empty for none.
   * @param caption - Overrides the default "spent · left of limit" caption.
   */
  update(budget: PointsBudget, note = "", caption?: string): void {
    this.budget = budget;
    this.refusal?.remove(false);
    this.refusal = null;
    this.paint(caption ?? budgetCaption(budget), note);
  }

  /**
   * Replace the caption with a refusal reason for a moment.
   *
   * @param reason - Why the last action was refused.
   */
  flashRefusal(reason: string): void {
    this.refusal?.remove(false);
    this.caption.setText(reason).setColor(toCssColor(HOLO_PALETTE.warning));
    this.refusal = this.scene.time.delayedCall(REFUSAL_MS, () => {
      this.refusal = null;
      if (this.budget) this.update(this.budget, this.note.text);
    });
  }

  /** The strip's caption as shown (e2e / debugging). */
  get captionText(): string {
    return this.caption.text;
  }

  destroy(): void {
    this.refusal?.remove(false);
    this.root.destroy();
  }

  private paint(caption: string, note: string): void {
    const budget = this.budget!;
    const color = budget.over ? HOLO_PALETTE.danger : HOLO_PALETTE.success;
    const gaugeW = this.rect.width * GAUGE_SHARE;
    const gaugeY = this.rect.y + (POINTS_BAR_H - GAUGE_H) / 2;
    this.gauge.clear();
    this.gauge.fillStyle(HOLO_PALETTE.border, 0.6);
    this.gauge.fillRect(this.rect.x + HOLO_SPACING.md, gaugeY, gaugeW, GAUGE_H);
    this.gauge.fillStyle(color, 1);
    this.gauge.fillRect(
      this.rect.x + HOLO_SPACING.md,
      gaugeY,
      gaugeW * budget.fraction,
      GAUGE_H,
    );
    this.caption.setText(caption).setColor(toCssColor(color));
    this.note.setText(note);
  }
}
