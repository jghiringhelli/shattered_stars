/**
 * Settings rows — a holo slider row and a holo switch row. Both are
 * keyboard-focusable (MenuFocus targets): sliders step with ←/→, switches
 * flip on ENTER; pointer drag / click works as before.
 */

import Phaser from "phaser";
import type { FocusTarget } from "../menu/MenuFocus";
import {
  drawHoloFrame,
  drawHoloGauge,
  type HoloRect,
} from "../menu/holoChrome";
import { holoFont } from "../theme/holoFont";
import {
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_RADIUS,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
} from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { playUiHover, playUiPress } from "../menu/menuTransitions";

/** Row geometry shared by sliders and switches. */
export const SETTINGS_ROW = {
  height: 60,
  padding: HOLO_SPACING.md,
  gaugeHeight: 6,
  knobRadius: 7,
  switchWidth: 46,
  switchHeight: 24,
  switchKnobInset: 4,
  labelSize: 15,
  valueSize: 14,
  focusFillAlpha: 0.12,
  hoverBorderAlpha: 0.5,
  /** Fraction a keyboard step moves a slider. */
  sliderStep: 0.1,
  /** Extra vertical grab margin around the gauge. */
  gaugeGrab: 12,
} as const;

/** Common row placement. */
export interface SettingsRowConfig {
  /** Row top-left x. */
  readonly x: number;
  /** Row top-left y. */
  readonly y: number;
  readonly width: number;
  readonly label: string;
  /** Row height. Default: SETTINGS_ROW.height. */
  readonly height?: number;
}

/** Base row: focus/hover frame + label. */
export abstract class SettingsRowBase implements FocusTarget {
  protected readonly frame: Phaser.GameObjects.Graphics;
  protected readonly labelText: Phaser.GameObjects.Text;
  private focused = false;
  private hovered = false;

  protected constructor(
    protected readonly scene: Phaser.Scene,
    protected readonly config: SettingsRowConfig,
  ) {
    this.frame = scene.add.graphics();
    this.labelText = scene.add
      .text(
        config.x + SETTINGS_ROW.padding,
        config.y + SETTINGS_ROW.padding,
        config.label,
        {
          ...holoFont(SETTINGS_ROW.labelSize, "400"),
          color: toCssColor(HOLO_PALETTE.textPrimary),
        },
      )
      .setOrigin(0, 0);
  }

  /** Row height in px. */
  protected get rowHeight(): number {
    return this.config.height ?? SETTINGS_ROW.height;
  }

  /**
   * Show or hide the keyboard-focus frame.
   *
   * @param focused - New focus state.
   */
  setFocused(focused: boolean): void {
    this.focused = focused;
    this.drawFrame();
  }

  /** Primary action for ENTER. */
  abstract activate(): void;

  protected setHovered(hovered: boolean): void {
    if (hovered && !this.hovered) playUiHover();
    this.hovered = hovered;
    this.drawFrame();
  }

  protected rowRect(): HoloRect {
    return {
      x: this.config.x,
      y: this.config.y,
      width: this.config.width,
      height: this.rowHeight,
    };
  }

  private drawFrame(): void {
    this.frame.clear();
    if (!this.focused && !this.hovered) return;
    drawHoloFrame(this.frame, this.rowRect(), {
      fill: HOLO_PALETTE.accent,
      fillAlpha: SETTINGS_ROW.focusFillAlpha,
      accent: HOLO_PALETTE.accent,
      borderWidth: this.focused ? HOLO_BORDER.focus : HOLO_BORDER.hairline,
      borderAlpha: this.focused ? 1 : SETTINGS_ROW.hoverBorderAlpha,
      radius: HOLO_RADIUS.sm,
    });
  }
}

/** Slider row: label, percentage and a draggable gauge. */
export class SettingsSliderRow extends SettingsRowBase {
  private readonly gauge: Phaser.GameObjects.Graphics;
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly gaugeRect: HoloRect;

  /**
   * @param scene - Settings scene.
   * @param config - Placement and label.
   * @param value - Initial value in [0, 1].
   * @param onChange - Called with each new value.
   */
  constructor(
    scene: Phaser.Scene,
    config: SettingsRowConfig,
    private value: number,
    private readonly onChange: (value: number) => void,
  ) {
    super(scene, config);
    const pad = SETTINGS_ROW.padding;
    this.gaugeRect = {
      x: config.x + pad,
      y: config.y + SETTINGS_ROW.height - pad - SETTINGS_ROW.gaugeHeight,
      width: config.width - pad * 2,
      height: SETTINGS_ROW.gaugeHeight,
    };
    this.gauge = scene.add.graphics();
    this.valueText = scene.add
      .text(config.x + config.width - pad, config.y + pad, "", {
        ...holoFont(SETTINGS_ROW.valueSize, "600"),
        color: toCssColor(HOLO_PALETTE.accent),
      })
      .setOrigin(1, 0);
    this.bindPointer();
    this.render();
  }

  /** Sliders have no ENTER action (use {@link adjust}). */
  activate(): void {}

  /**
   * Step the value by a signed number of keyboard steps.
   *
   * @param steps - +1 / -1 per key press.
   */
  adjust(steps: number): void {
    playUiHover();
    this.setValue(this.value + steps * SETTINGS_ROW.sliderStep);
  }

  private setValue(next: number): void {
    this.value = Phaser.Math.Clamp(Math.round(next * 100) / 100, 0, 1);
    this.render();
    this.onChange(this.value);
  }

  private bindPointer(): void {
    const r = this.gaugeRect;
    const grab = SETTINGS_ROW.gaugeGrab;
    const hit = this.scene.add
      .rectangle(
        r.x + r.width / 2,
        r.y + r.height / 2,
        r.width + grab * 2,
        r.height + grab * 2,
        0,
        0,
      )
      .setInteractive({ useHandCursor: true });
    const fromPointer = (pointer: Phaser.Input.Pointer): void =>
      this.setValue((pointer.x - r.x) / r.width);
    hit.on("pointerdown", fromPointer);
    hit.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) fromPointer(pointer);
    });
    hit.on("pointerover", () => this.setHovered(true));
    hit.on("pointerout", () => this.setHovered(false));
  }

  private render(): void {
    const r = this.gaugeRect;
    const knobX = r.x + r.width * this.value;
    const knobY = r.y + r.height / 2;
    this.gauge.clear();
    drawHoloGauge(this.gauge, r, this.value, HOLO_PALETTE.accent);
    this.gauge.fillStyle(HOLO_PALETTE.textPrimary, 1);
    this.gauge.fillCircle(knobX, knobY, SETTINGS_ROW.knobRadius);
    this.gauge.lineStyle(HOLO_BORDER.regular, HOLO_PALETTE.accent, 1);
    this.gauge.strokeCircle(knobX, knobY, SETTINGS_ROW.knobRadius);
    this.valueText.setText(`${Math.round(this.value * 100)}%`);
  }
}

/** Switch row: label, ON/OFF caption and a pill switch. */
export class SettingsSwitchRow extends SettingsRowBase {
  private readonly track: Phaser.GameObjects.Graphics;
  private readonly stateText: Phaser.GameObjects.Text;

  /**
   * @param scene - Settings scene.
   * @param config - Placement and label.
   * @param value - Initial state.
   * @param onChange - Called with each new state.
   */
  constructor(
    scene: Phaser.Scene,
    config: SettingsRowConfig,
    private value: boolean,
    private readonly onChange: (value: boolean) => void,
  ) {
    super(scene, config);
    const midY = config.y + this.rowHeight / 2;
    this.labelText.setY(midY).setOrigin(0, 0.5);
    this.track = scene.add.graphics();
    this.stateText = scene.add
      .text(this.switchLeft() - HOLO_SPACING.md, midY, "", {
        ...holoFont(HOLO_TYPE_SCALE.caption.size, "600"),
      })
      .setLetterSpacing(HOLO_TYPE_SCALE.caption.letterSpacing)
      .setOrigin(1, 0.5);
    const rect = this.rowRect();
    const hit = scene.add
      .rectangle(rect.x + rect.width / 2, midY, rect.width, rect.height, 0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => this.activate());
    hit.on("pointerover", () => this.setHovered(true));
    hit.on("pointerout", () => this.setHovered(false));
    this.render();
  }

  /** Flip the switch. */
  activate(): void {
    playUiPress();
    this.value = !this.value;
    this.render();
    this.onChange(this.value);
  }

  /** Current state. */
  get checked(): boolean {
    return this.value;
  }

  private switchLeft(): number {
    const { x, width } = this.config;
    return x + width - SETTINGS_ROW.padding - SETTINGS_ROW.switchWidth;
  }

  private render(): void {
    const w = SETTINGS_ROW.switchWidth;
    const h = SETTINGS_ROW.switchHeight;
    const x = this.switchLeft();
    const y = this.config.y + (this.rowHeight - h) / 2;
    const on = this.value;
    this.track.clear();
    drawHoloFrame(
      this.track,
      { x, y, width: w, height: h },
      {
        radius: h / 2,
        fill: on ? HOLO_PALETTE.accent : HOLO_PALETTE.panelFill,
        fillAlpha: on ? 0.3 : 0.9,
        accent: on ? HOLO_PALETTE.accent : HOLO_PALETTE.border,
        borderAlpha: 1,
      },
    );
    const knobX = on ? x + w - h / 2 : x + h / 2;
    this.track.fillStyle(
      on ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textMuted,
    );
    this.track.fillCircle(
      knobX,
      y + h / 2,
      h / 2 - SETTINGS_ROW.switchKnobInset,
    );
    this.stateText
      .setText(on ? "ON" : "OFF")
      .setColor(toCssColor(on ? HOLO_PALETTE.accent : HOLO_PALETTE.textMuted));
  }
}
