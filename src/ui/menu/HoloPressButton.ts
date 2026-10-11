/**
 * HoloPressButton — the holographic face behind ButtonFactory.createHoverButton.
 *
 * Looks exactly like HoloButton (same variant table) but keeps the legacy
 * ButtonFactory contract: fires on pointer *press* with a punch tween, and
 * hit-tests a rectangle centred on the container. Adds focus / enabled /
 * label setters so menus can drive keyboard focus.
 */

import Phaser from "phaser";
import { HOLO_ALPHA, HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { holoFont } from "../theme/holoFont";
import {
  BUTTON_VARIANTS,
  type ButtonInteraction,
  type ButtonVisual,
  type HoloButtonVariant,
} from "../hud/holoButtonStyle";
import { drawHoloButtonFace } from "./holoChrome";
import { drawMenuIcon, type MenuIconName } from "./MenuIcons";
import { punch, tweenScale } from "../UIJuice";

/** Punch tween applied on press (matches the legacy factory feel). */
const PRESS_PUNCH = { scale: 1.04, durationMs: 140 } as const;
/** Label letter spacing for small/regular labels. */
const LABEL_LETTER_SPACING = 1;
/** Icon box size relative to label font size. */
const ICON_SCALE = 1.0;
/** Gap between icon and label in pixels. */
const ICON_GAP = 8;

/** Construction options for {@link HoloPressButton}. */
export interface PressButtonConfig {
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly variant: HoloButtonVariant;
  readonly radius?: number;
  readonly fontSize: number;
  readonly fontWeight: string;
  /** Label scale applied on hover (legacy `hoverScale`). Default 1. */
  readonly hoverScale?: number;
  /** Optional glyph drawn left of the label. */
  readonly icon?: MenuIconName;
}

/** Press-to-fire holographic button. */
export class HoloPressButton extends Phaser.GameObjects.Container {
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly glyph: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private variant: HoloButtonVariant;
  private interaction: ButtonInteraction = "idle";
  private isEnabled = true;
  private isFocused = false;

  /**
   * @param scene - Owning scene.
   * @param x - Centre x.
   * @param y - Centre y.
   * @param config - Size, label, variant and type.
   * @param onPress - Invoked on pointer press while enabled.
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly config: PressButtonConfig,
    private readonly onPress: () => void,
  ) {
    super(scene, x, y);
    this.variant = config.variant;
    this.face = scene.add.graphics();
    this.glyph = scene.add.graphics();
    this.labelText = scene.add
      .text(0, 0, config.label, holoFont(config.fontSize, config.fontWeight))
      .setLetterSpacing(LABEL_LETTER_SPACING)
      .setOrigin(0.5);
    this.add([this.face, this.glyph, this.labelText]);
    // No setSize(): a sized container shifts Phaser's hit-test origin, and
    // the legacy factory's centred hit rectangle assumes an unsized one.
    this.setInteractive(
      new Phaser.Geom.Rectangle(
        -config.width / 2,
        -config.height / 2,
        config.width,
        config.height,
      ),
      Phaser.Geom.Rectangle.Contains,
    );
    if (this.input) this.input.cursor = "pointer";
    this.bindPointer();
    this.redraw();
  }

  /** Whether the button accepts presses. */
  get enabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Show or hide the keyboard-focus ring.
   *
   * @param focused - New focus state.
   * @returns This button.
   */
  setFocused(focused: boolean): this {
    this.isFocused = focused;
    this.redraw();
    return this;
  }

  /**
   * Enable or disable the button (disabled presses are ignored).
   *
   * @param enabled - New state.
   * @returns This button.
   */
  setEnabled(enabled: boolean): this {
    this.isEnabled = enabled;
    if (!enabled) this.interaction = "idle";
    if (this.input) this.input.cursor = enabled ? "pointer" : "default";
    this.redraw();
    return this;
  }

  /**
   * Change the visual variant.
   *
   * @param variant - New variant.
   * @returns This button.
   */
  setVariant(variant: HoloButtonVariant): this {
    this.variant = variant;
    this.redraw();
    return this;
  }

  /**
   * Replace the label text (kept verbatim — no case change).
   *
   * @param label - New label.
   * @returns This button.
   */
  setLabel(label: string): this {
    this.labelText.setText(label);
    this.redraw();
    return this;
  }

  /** Activate as if pressed (keyboard / gamepad confirm). */
  activate(): void {
    if (this.isEnabled) this.onPress();
  }

  private bindPointer(): void {
    const hoverScale = this.config.hoverScale ?? 1;
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      this.setInteraction("hover");
      if (this.isEnabled) tweenScale(this.scene, this.labelText, hoverScale);
    });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      this.setInteraction("idle");
      tweenScale(this.scene, this.labelText, 1);
    });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      if (!this.isEnabled) return;
      this.setInteraction("pressed");
      punch(this.scene, this, PRESS_PUNCH);
      this.onPress();
    });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () =>
      this.setInteraction("hover"),
    );
  }

  private setInteraction(state: ButtonInteraction): void {
    if (!this.isEnabled || !this.scene) return;
    this.interaction = state;
    this.redraw();
  }

  private currentVisual(): ButtonVisual {
    const table = BUTTON_VARIANTS[this.variant];
    return this.isEnabled ? table[this.interaction] : table.idle;
  }

  private redraw(): void {
    const visual = this.currentVisual();
    const alpha = this.isEnabled ? 1 : HOLO_ALPHA.disabled;
    drawHoloButtonFace(this.face, visual, {
      width: this.config.width,
      height: this.config.height,
      alpha,
      focused: this.isFocused,
      radius: this.config.radius ?? HOLO_RADIUS.md,
    });
    const textColor = this.isFocused ? HOLO_PALETTE.textPrimary : visual.text;
    this.labelText.setColor(toCssColor(textColor)).setAlpha(alpha);
    this.layoutIcon(textColor, alpha);
  }

  private layoutIcon(color: number, alpha: number): void {
    this.glyph.clear();
    const icon = this.config.icon;
    if (icon === undefined) return;
    const size = this.config.fontSize * ICON_SCALE;
    const hasLabel = this.labelText.text.length > 0;
    const gap = hasLabel ? ICON_GAP : 0;
    const total = size + gap + this.labelText.width;
    const iconX = hasLabel ? -total / 2 + size / 2 : 0;
    this.labelText.setX(
      hasLabel ? iconX + size / 2 + gap + this.labelText.width / 2 : 0,
    );
    drawMenuIcon(this.glyph, icon, { x: iconX, y: 0 }, size, color);
    this.glyph.setAlpha(alpha);
  }
}
