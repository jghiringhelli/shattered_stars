/**
 * HoloButton — holographic action button with primary / secondary / danger
 * variants, hover / pressed / disabled states and a keyboard-focus ring.
 *
 * `createHoloButton(scene, x, y, config, onClick)` mirrors ButtonFactory's
 * `createHoverButton` signature and returns a Container subclass, so call
 * sites can migrate by swapping the factory and config. Fires on pointer
 * release over the button (press-and-drag-off cancels). Keep buttons on
 * screens at camera zoom 1: Phaser mis-hit-tests scrollFactor(0) objects
 * under zoom.
 */

import Phaser from "phaser";
import {
  HOLO_ALPHA,
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_RADIUS,
} from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { createHoloText } from "./holoPrimitives";
import {
  BUTTON_VARIANTS,
  type ButtonInteraction,
  type ButtonVisual,
  type HoloButtonVariant,
} from "./holoButtonStyle";
import { playUiHover, playUiPress } from "../menu/menuTransitions";

export type { HoloButtonVariant } from "./holoButtonStyle";

/** Gap between the button edge and the focus ring. */
const FOCUS_OFFSET = 3;

/** HoloButton construction options (superset-compatible with HoverButtonConfig). */
export interface HoloButtonConfig {
  readonly width: number;
  readonly height: number;
  readonly label: string;
  /** Visual variant. Default: "secondary". */
  readonly variant?: HoloButtonVariant;
  /** Corner radius. Default: HOLO_RADIUS.md. */
  readonly radius?: number;
  /** CSS font override (ButtonFactory compatibility); default uses the holo type scale. */
  readonly font?: string;
  /** Start disabled. Default: false. */
  readonly disabled?: boolean;
}

/** Interactive holographic button. */
export class HoloButton extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly buttonWidth: number;
  private readonly buttonHeight: number;
  private readonly radius: number;
  private variant: HoloButtonVariant;
  private interaction: ButtonInteraction = "idle";
  private isEnabled: boolean;
  private isFocused = false;

  /**
   * @param scene - Owning scene.
   * @param x - Centre x.
   * @param y - Centre y.
   * @param config - Size, label and variant.
   * @param onClick - Invoked on activation while enabled.
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    config: HoloButtonConfig,
    private readonly onClick: () => void,
  ) {
    super(scene, x, y);
    this.buttonWidth = config.width;
    this.buttonHeight = config.height;
    this.radius = config.radius ?? HOLO_RADIUS.md;
    this.variant = config.variant ?? "secondary";
    this.isEnabled = config.disabled !== true;
    this.bg = scene.add.graphics();
    this.labelText = createHoloText(
      scene,
      0,
      0,
      config.label.toUpperCase(),
      "heading",
    );
    if (config.font !== undefined) this.labelText.setFont(config.font);
    this.add([this.bg, this.labelText]);
    this.setSize(config.width, config.height);
    this.setInteractive({ useHandCursor: true });
    this.bindPointer();
    this.redraw();
  }

  /** Whether the button accepts activation. */
  get enabled(): boolean {
    return this.isEnabled;
  }

  /** Whether the keyboard-focus ring is shown. */
  get focused(): boolean {
    return this.isFocused;
  }

  /**
   * Enable or disable the button.
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
   * Show or hide the keyboard-focus ring (driven by menu navigation).
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
   * Replace the label.
   *
   * @param label - New label text.
   * @returns This button.
   */
  setLabel(label: string): this {
    this.labelText.setText(label.toUpperCase());
    return this;
  }

  /** Activate as if clicked (keyboard / gamepad confirm). No-op while disabled. */
  activate(): void {
    if (!this.isEnabled) return;
    playUiPress();
    this.onClick();
  }

  private bindPointer(): void {
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      this.setInteraction("hover");
      if (this.isEnabled) playUiHover();
    });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () =>
      this.setInteraction("idle"),
    );
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () =>
      this.setInteraction("pressed"),
    );
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      const wasPressed = this.interaction === "pressed";
      this.setInteraction("hover");
      if (wasPressed) this.activate();
    });
  }

  private setInteraction(state: ButtonInteraction): void {
    if (!this.isEnabled) return;
    this.interaction = state;
    this.redraw();
  }

  private currentVisual(): ButtonVisual {
    const palette = BUTTON_VARIANTS[this.variant];
    if (!this.isEnabled) return palette.idle;
    return palette[this.interaction];
  }

  private redraw(): void {
    const visual = this.currentVisual();
    const w = this.buttonWidth;
    const h = this.buttonHeight;
    const contentAlpha = this.isEnabled ? 1 : HOLO_ALPHA.disabled;
    this.bg.clear();
    this.bg.fillStyle(visual.fill, visual.fillAlpha * contentAlpha);
    this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, this.radius);
    this.bg.lineStyle(visual.borderWidth, visual.border, contentAlpha);
    this.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, this.radius);
    if (this.isFocused) this.drawFocusRing();
    this.labelText.setColor(toCssColor(visual.text)).setAlpha(contentAlpha);
  }

  private drawFocusRing(): void {
    const w = this.buttonWidth + FOCUS_OFFSET * 2;
    const h = this.buttonHeight + FOCUS_OFFSET * 2;
    this.bg.lineStyle(HOLO_BORDER.focus, HOLO_PALETTE.accent, 1);
    this.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, this.radius + FOCUS_OFFSET);
  }
}

/**
 * Create a HoloButton and add it to the scene display list.
 * Signature mirrors ButtonFactory.createHoverButton.
 *
 * @param scene - Owning scene.
 * @param x - Centre x.
 * @param y - Centre y.
 * @param config - Size, label, variant.
 * @param onClick - Invoked on activation.
 * @returns The button container.
 */
export function createHoloButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  config: HoloButtonConfig,
  onClick: () => void,
): HoloButton {
  return scene.add.existing(new HoloButton(scene, x, y, config, onClick));
}
