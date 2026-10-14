/**
 * HoloPanel — dark translucent rounded panel with a thin faction-coloured
 * border, corner accent ticks and an optional header strip.
 *
 * Origin is the panel centre (same convention as ButtonFactory buttons).
 * Add content with `panel.add(child)`; `contentTop` gives the first free y
 * below the header.
 */

import Phaser from "phaser";
import type { FactionId } from "../../config";
import {
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_RADIUS,
  HOLO_SPACING,
  factionAccent,
} from "../theme/HoloTheme";
import { createHoloText } from "./holoPrimitives";

/** Header strip height in pixels. */
const HEADER_HEIGHT = 28;
/** Header strip fill opacity (tinted with the accent). */
const HEADER_FILL_ALPHA = 0.2;
/** Border opacity — thin but clearly coloured. */
const BORDER_ALPHA = 0.75;
/** Length of the bright L-shaped ticks at each corner. */
const CORNER_TICK = 10;

/** HoloPanel construction options. */
export interface HoloPanelConfig {
  readonly width: number;
  readonly height: number;
  /** Faction whose accent colours the border/header. */
  readonly faction?: FactionId;
  /** Explicit accent colour; overrides `faction`. */
  readonly accentColor?: number;
  /** Header title; when set a header strip is drawn. */
  readonly title?: string;
  /** Corner radius. Default: HOLO_RADIUS.md. */
  readonly radius?: number;
  /** Fill opacity. Default: HOLO_PALETTE.panelAlpha. */
  readonly fillAlpha?: number;
  /** Header title font size in px (default: the holo caption step). */
  readonly titleSize?: number;
}

/** Translucent holographic panel container. */
export class HoloPanel extends Phaser.GameObjects.Container {
  private readonly chrome: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private panelWidth: number;
  private panelHeight: number;
  private accent: number;
  private readonly radius: number;
  private readonly fillAlpha: number;

  /**
   * @param scene - Owning scene.
   * @param x - Centre x.
   * @param y - Centre y.
   * @param config - Size, accent and header options.
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    config: HoloPanelConfig,
  ) {
    super(scene, x, y);
    this.panelWidth = config.width;
    this.panelHeight = config.height;
    this.accent = config.accentColor ?? factionAccent(config.faction);
    this.radius = config.radius ?? HOLO_RADIUS.md;
    this.fillAlpha = config.fillAlpha ?? HOLO_PALETTE.panelAlpha;
    this.chrome = scene.add.graphics();
    this.titleText = createHoloText(
      scene,
      0,
      0,
      (config.title ?? "").toUpperCase(),
      "caption",
    );
    this.titleText.setOrigin(0, 0.5);
    if (config.titleSize !== undefined) {
      this.titleText.setFontSize(config.titleSize);
    }
    this.add([this.chrome, this.titleText]);
    this.redraw();
  }

  /** True when a header strip is shown. */
  get hasHeader(): boolean {
    return this.titleText.text.length > 0;
  }

  /** Local y (relative to the centre) where content below the header starts. */
  get contentTop(): number {
    const top = -this.panelHeight / 2 + HOLO_SPACING.md;
    return this.hasHeader ? top + HEADER_HEIGHT : top;
  }

  /**
   * Replace the header title; an empty string removes the header strip.
   *
   * @param title - New title.
   * @returns This panel.
   */
  setTitle(title: string): this {
    this.titleText.setText(title.toUpperCase());
    this.redraw();
    return this;
  }

  /**
   * Recolour border and header.
   *
   * @param color - New accent colour.
   * @returns This panel.
   */
  setAccent(color: number): this {
    this.accent = color;
    this.redraw();
    return this;
  }

  /**
   * Resize around the centre.
   *
   * @param width - New width.
   * @param height - New height.
   * @returns This panel.
   */
  resize(width: number, height: number): this {
    this.panelWidth = width;
    this.panelHeight = height;
    this.redraw();
    return this;
  }

  private redraw(): void {
    const g = this.chrome;
    const left = -this.panelWidth / 2;
    const top = -this.panelHeight / 2;
    g.clear();
    g.fillStyle(HOLO_PALETTE.panelFill, this.fillAlpha);
    g.fillRoundedRect(
      left,
      top,
      this.panelWidth,
      this.panelHeight,
      this.radius,
    );
    if (this.hasHeader) this.drawHeader(left, top);
    g.lineStyle(HOLO_BORDER.hairline, this.accent, BORDER_ALPHA);
    g.strokeRoundedRect(
      left,
      top,
      this.panelWidth,
      this.panelHeight,
      this.radius,
    );
    this.drawCornerTicks(left, top);
  }

  private drawHeader(left: number, top: number): void {
    const g = this.chrome;
    g.fillStyle(this.accent, HEADER_FILL_ALPHA);
    g.fillRoundedRect(left, top, this.panelWidth, HEADER_HEIGHT, {
      tl: this.radius,
      tr: this.radius,
      bl: 0,
      br: 0,
    });
    g.lineStyle(HOLO_BORDER.regular, this.accent, 1);
    g.lineBetween(
      left,
      top + HEADER_HEIGHT,
      left + this.panelWidth,
      top + HEADER_HEIGHT,
    );
    this.titleText.setPosition(left + HOLO_SPACING.md, top + HEADER_HEIGHT / 2);
  }

  private drawCornerTicks(left: number, top: number): void {
    const g = this.chrome;
    const right = left + this.panelWidth;
    const bottom = top + this.panelHeight;
    g.lineStyle(HOLO_BORDER.regular, this.accent, 1);
    for (const [x, y, dx, dy] of [
      [left, top, 1, 1],
      [right, top, -1, 1],
      [left, bottom, 1, -1],
      [right, bottom, -1, -1],
    ] as const) {
      g.lineBetween(
        x,
        y + dy * this.radius,
        x,
        y + dy * (this.radius + CORNER_TICK),
      );
      g.lineBetween(
        x + dx * this.radius,
        y,
        x + dx * (this.radius + CORNER_TICK),
        y,
      );
    }
  }
}

/**
 * Create a HoloPanel and add it to the scene display list.
 *
 * @param scene - Owning scene.
 * @param x - Centre x.
 * @param y - Centre y.
 * @param config - Panel options.
 * @returns The panel.
 */
export function createHoloPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  config: HoloPanelConfig,
): HoloPanel {
  return scene.add.existing(new HoloPanel(scene, x, y, config));
}
