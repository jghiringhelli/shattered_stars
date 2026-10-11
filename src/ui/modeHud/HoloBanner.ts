/**
 * HoloBanner — centred announcement ("WAVE 3 / Mixed Squadron", "MISSION
 * START") in the holographic type scale: a thin accent rule between a light
 * title and a secondary subtitle, fading out on its own.
 */

import Phaser from "phaser";
import {
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
} from "../theme/HoloTheme";
import { createHoloText } from "../hud/holoPrimitives";

/** Banner title size multiplier over the type scale's title step. */
const TITLE_SCALE = 1.5;
/** Half-width of the accent rule under the title (px). */
const RULE_HALF_WIDTH = 160;
/** Vertical position as a fraction of the screen height. */
const SCREEN_Y_FRACTION = 0.38;
/** How long a banner stays fully visible, then how long it fades (ms). */
const HOLD_MS = 1500;
const FADE_MS = 500;

/** Centred, self-fading announcement banner. */
export class HoloBanner {
  /** Banner root (child of a screen-space HUD root). */
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly rule: Phaser.GameObjects.Graphics;

  /**
   * @param scene - Owning scene.
   * @param accent - Rule colour (faction accent).
   */
  constructor(scene: Phaser.Scene, accent: number) {
    this.scene = scene;
    const x = scene.scale.width / 2;
    const y = scene.scale.height * SCREEN_Y_FRACTION;
    this.title = createHoloText(scene, 0, 0, "", "title");
    this.title.setFontSize(HOLO_TYPE_SCALE.title.size * TITLE_SCALE);
    this.rule = scene.add.graphics();
    this.rule.lineStyle(HOLO_BORDER.regular, accent, 1);
    this.rule.lineBetween(-RULE_HALF_WIDTH, 0, RULE_HALF_WIDTH, 0);
    this.subtitle = createHoloText(
      scene,
      0,
      0,
      "",
      "heading",
      HOLO_PALETTE.textSecondary,
    );
    this.container = scene.add
      .container(x, y, [this.title, this.rule, this.subtitle])
      .setAlpha(0);
  }

  /** The text currently (or last) shown, "TITLE\nsubtitle". */
  get text(): string {
    return `${this.title.text}\n${this.subtitle.text}`;
  }

  /**
   * Show a banner; it fades out after a moment.
   *
   * @param title - Main line.
   * @param subtitle - Second line (may be empty).
   */
  show(title: string, subtitle: string): void {
    this.title.setText(title.toUpperCase());
    this.subtitle.setText(subtitle);
    this.title.setY(-this.title.height / 2 - HOLO_SPACING.sm);
    this.subtitle.setY(this.subtitle.height / 2 + HOLO_SPACING.sm);
    this.scene.tweens.killTweensOf(this.container);
    this.container.setAlpha(1);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      delay: HOLD_MS,
      duration: FADE_MS,
    });
  }

  /** Hide immediately (e.g. under a game-over overlay). */
  hide(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.setAlpha(0);
  }
}
