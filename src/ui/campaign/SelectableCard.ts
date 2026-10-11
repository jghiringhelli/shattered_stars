/**
 * SelectableCard — translucent holo card (list row / faction card) with
 * hover and keyboard-focus states. Idle: neutral hairline border. Hover or
 * focus: accent border, faint accent fill and corner ticks. Fires on press.
 *
 * Origin is the card centre; children are added in local coordinates.
 */

import Phaser from "phaser";
import { drawHoloFrame } from "../menu/holoChrome";
import { HOLO_BORDER, HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";

/** Card construction options. */
export interface SelectableCardConfig {
  readonly width: number;
  readonly height: number;
  /** Highlight colour (faction accent). */
  readonly accent: number;
  /** Idle border colour. Default: neutral panel border. */
  readonly idleBorder?: number;
  /** Idle border opacity. Default: HOLO_PALETTE.borderAlpha. */
  readonly idleBorderAlpha?: number;
  /** Idle fill tint and alpha (e.g. faint accent wash for "available"). */
  readonly idleFill?: { readonly color: number; readonly alpha: number };
  /** Draw a solid accent bar down the left edge. */
  readonly accentBar?: boolean;
}

/** Visual constants for card states. */
const CARD_STYLE = {
  hoverFillAlpha: 0.16,
  accentBarWidth: 4,
  accentBarInset: 1,
} as const;

/** Holographic selectable card. */
export class SelectableCard extends Phaser.GameObjects.Container {
  private readonly frame: Phaser.GameObjects.Graphics;
  private hovered = false;
  private focused = false;

  /**
   * @param scene - Owning scene.
   * @param x - Centre x.
   * @param y - Centre y.
   * @param config - Size and colours.
   * @param onSelect - Invoked on press / activate; omit for static cards.
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly config: SelectableCardConfig,
    private readonly onSelect?: () => void,
  ) {
    super(scene, x, y);
    this.frame = scene.add.graphics();
    this.add(this.frame);
    this.setSize(config.width, config.height);
    if (onSelect) this.bindPointer(config.width, config.height);
    this.redraw();
    scene.add.existing(this);
  }

  /** Whether the card reacts to selection. */
  get enabled(): boolean {
    return this.onSelect !== undefined;
  }

  /** Left edge in local coordinates. */
  get left(): number {
    return -this.config.width / 2;
  }

  /** Right edge in local coordinates. */
  get right(): number {
    return this.config.width / 2;
  }

  /**
   * Show or hide the keyboard-focus highlight.
   *
   * @param focused - New focus state.
   * @returns This card.
   */
  setFocused(focused: boolean): this {
    this.focused = focused;
    this.redraw();
    return this;
  }

  /** Select the card as if pressed. */
  activate(): void {
    this.onSelect?.();
  }

  private bindPointer(width: number, height: number): void {
    this.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains,
    );
    if (this.input) this.input.cursor = "pointer";
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () =>
      this.setHovered(true),
    );
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () =>
      this.setHovered(false),
    );
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.activate());
  }

  private setHovered(hovered: boolean): void {
    if (!this.scene) return;
    this.hovered = hovered;
    this.redraw();
  }

  private redraw(): void {
    const { width, height, accent } = this.config;
    const rect = { x: -width / 2, y: -height / 2, width, height };
    const lit = this.hovered || this.focused;
    const g = this.frame;
    g.clear();
    drawHoloFrame(g, rect, { fillAlpha: HOLO_PALETTE.panelAlpha });
    const wash = lit
      ? { color: accent, alpha: CARD_STYLE.hoverFillAlpha }
      : this.config.idleFill;
    drawHoloFrame(g, rect, {
      accent: lit ? accent : (this.config.idleBorder ?? HOLO_PALETTE.border),
      fill: wash?.color ?? HOLO_PALETTE.panelFill,
      fillAlpha: wash?.alpha ?? 0,
      borderWidth: lit ? HOLO_BORDER.regular : HOLO_BORDER.hairline,
      borderAlpha: lit
        ? 1
        : (this.config.idleBorderAlpha ?? HOLO_PALETTE.borderAlpha),
      cornerTicks: lit,
    });
    if (this.config.accentBar === true) this.drawAccentBar(rect);
  }

  private drawAccentBar(rect: {
    readonly x: number;
    readonly y: number;
    readonly height: number;
  }): void {
    const inset = CARD_STYLE.accentBarInset;
    const barTop = rect.y + HOLO_RADIUS.md;
    this.frame.fillStyle(this.config.accent, 1);
    this.frame.fillRect(
      rect.x + inset,
      barTop,
      CARD_STYLE.accentBarWidth,
      rect.height - HOLO_RADIUS.md * 2,
    );
  }
}
